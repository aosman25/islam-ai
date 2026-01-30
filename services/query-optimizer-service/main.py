import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List

import structlog
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from dotenv import load_dotenv
from utils import generate_prompt, resolve_categories
from models import (
    OptimizedQueryResponse,
    QueryRequest,
    QueryResponse,
    HealthResponse,
    ErrorResponse,
)

# Import .env file
load_dotenv()


# Configuration
class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    MAX_QUERIES_PER_REQUEST = int(os.getenv("MAX_QUERIES_PER_REQUEST", "10"))
    MAX_QUERY_LENGTH = int(os.getenv("MAX_QUERY_LENGTH", "1000"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
    GEMINI_MODEL = os.getenv("GEMINI_OPTIMIZE_MODEL", "gemini-2.5-flash-lite")

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is required")


# Logging setup
def setup_logging():
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, Config.LOG_LEVEL),
    )


# Global variables
gemini_client = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global gemini_client

    # Startup
    try:
        logger.info("Starting Query Optimization Service")
        Config.validate()

        # Initialize Gemini client
        gemini_client = genai.Client(api_key=Config.GEMINI_API_KEY)

        # Test client connection
        await test_gemini_connection()

        logger.info("Service started successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Query Optimization Service")
        gemini_client = None


async def test_gemini_connection():
    """Test Gemini API connection during startup"""
    try:
        response = gemini_client.models.generate_content(
            model=Config.GEMINI_MODEL,
            contents="test",
            config={"response_mime_type": "text/plain"},
        )
        logger.info("Gemini API connection verified")
    except Exception as e:
        logger.error("Failed to connect to Gemini API", error=str(e))
        raise


# FastAPI app
app = FastAPI(
    title="Query Optimization API",
    description="Production-ready API for optimizing search queries using Gemini AI",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        os.getenv("ALLOWED_ORIGINS", "").split(",")
        if os.getenv("ALLOWED_ORIGINS")
        else []
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Request/response logging and timing"""
    request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")
    start_time = time.time()

    logger.info(
        "Request started",
        method=request.method,
        path=request.url.path,
        request_id=request_id,
    )

    response = await call_next(request)

    duration = time.time() - start_time
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=f"{duration:.3f}s",
        request_id=request_id,
    )

    response.headers["x-request-id"] = request_id
    return response


# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    request_id = request.headers.get("x-request-id", "unknown")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            error=str(exc),
            request_id=request_id,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id", "unknown")
    logger.error("Unhandled exception", error=str(exc), request_id=request_id)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal server error",
            request_id=request_id,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        ).model_dump(),
    )


# Retry logic for Gemini API calls
@retry(
    retry=retry_if_exception_type((Exception,)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True,
)
async def call_gemini_api(query: str) -> List[OptimizedQueryResponse]:
    """Call Gemini API with retry logic"""
    try:
        response = gemini_client.models.generate_content(
            model=Config.GEMINI_MODEL,
            contents=generate_prompt(query),
            config={
                "response_mime_type": "application/json",
                "response_schema": list[OptimizedQueryResponse],
            },
        )

        if not response.parsed:
            logger.warning("Empty response from Gemini API", query=query)
            return []

        # Resolve higher-order categories to actual Milvus category names
        results = response.parsed
        for result in results:
            if result.categories:
                result.categories = resolve_categories(result.categories)

        return results

    except Exception as e:
        logger.error("Gemini API call failed", error=str(e), query=query)
        raise


async def process_single_query(
    query: str, request_id: str
) -> List[OptimizedQueryResponse]:
    """Process a single query with proper error handling"""
    try:
        logger.info("Processing query", query=query, request_id=request_id)

        # Add timeout
        result = await asyncio.wait_for(
            call_gemini_api(query), timeout=Config.REQUEST_TIMEOUT
        )

        logger.info(
            "Query processed successfully",
            query=query,
            result_count=len(result),
            request_id=request_id,
        )
        return result

    except asyncio.TimeoutError:
        logger.error("Query processing timeout", query=query, request_id=request_id)
        return []
    except Exception as e:
        logger.error(
            "Query processing failed", error=str(e), query=query, request_id=request_id
        )
        return []


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    )


@app.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """Readiness check endpoint"""
    try:
        # Quick test of Gemini client
        if gemini_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - Gemini client not initialized",
            )

        return HealthResponse(
            status="ready",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        )
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Service not ready"
        )


# Main endpoint
@app.post(
    "/optimize-queries",
    response_model=QueryResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
    },
)
async def optimize_queries(request: QueryRequest, http_request: Request):
    """
    Optimize multiple search queries concurrently using Gemini AI.

    Processes up to 10 queries in parallel with proper error handling,
    timeouts, and retry logic.
    """
    request_id = http_request.headers.get(
        "x-request-id", f"req_{int(time.time() * 1000)}"
    )

    try:
        if gemini_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service unavailable - Gemini client not initialized",
            )

        # Process all queries concurrently
        tasks = [process_single_query(query, request_id) for query in request.queries]

        results = await asyncio.gather(*tasks, return_exceptions=False)

        # Flatten results
        optimized_queries = [item for sublist in results for item in sublist]

        logger.info(
            "Batch processing completed",
            input_count=len(request.queries),
            output_count=len(optimized_queries),
            request_id=request_id,
        )

        return QueryResponse(
            results=optimized_queries,
            processed_count=len(optimized_queries),
            request_id=request_id,
        )

    except Exception as e:
        logger.error("Batch processing failed", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process queries",
        )


if __name__ == "__main__":
    setup_logging()
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        log_config=None,  # Use our custom logging
        access_log=False,  # Handled by middleware
    )
