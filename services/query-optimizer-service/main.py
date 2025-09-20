import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import structlog
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from pydantic import BaseModel, Field, validator
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from utils import generate_prompt

# Configuration
class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    MAX_QUERIES_PER_REQUEST = int(os.getenv("MAX_QUERIES_PER_REQUEST", "10"))
    MAX_QUERY_LENGTH = int(os.getenv("MAX_QUERY_LENGTH", "1000"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    
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
            structlog.processors.JSONRenderer()
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

# Models
class OptimizedQueryResponse(BaseModel):
    optimized_query: str = Field(..., min_length=1, max_length=1000)
    sub_queries: Optional[List[str]] = Field(None, max_items=5)

class QueryRequest(BaseModel):
    queries: List[str] = Field(..., min_items=1, max_items=Config.MAX_QUERIES_PER_REQUEST)
    
    @validator('queries')
    def validate_queries(cls, v):
        # Filter out empty queries and validate length
        valid_queries = []
        for query in v:
            if query.strip():
                if len(query) > Config.MAX_QUERY_LENGTH:
                    raise ValueError(f"Query exceeds maximum length of {Config.MAX_QUERY_LENGTH} characters")
                valid_queries.append(query.strip())
        
        if not valid_queries:
            raise ValueError("At least one non-empty query is required")
        return valid_queries

class QueryResponse(BaseModel):
    results: List[OptimizedQueryResponse]
    processed_count: int
    request_id: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"

class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str

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
            config={"response_mime_type": "text/plain"}
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
    allow_origins=["*"],  # Configure appropriately for production
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
        request_id=request_id
    )
    
    response = await call_next(request)
    
    duration = time.time() - start_time
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=f"{duration:.3f}s",
        request_id=request_id
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
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        ).dict()
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
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        ).dict()
    )

# Retry logic for Gemini API calls
@retry(
    retry=retry_if_exception_type((Exception,)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True
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
            
        return response.parsed
        
    except Exception as e:
        logger.error("Gemini API call failed", error=str(e), query=query)
        raise

async def process_single_query(query: str, request_id: str) -> List[OptimizedQueryResponse]:
    """Process a single query with proper error handling"""
    try:
        logger.info("Processing query", query=query, request_id=request_id)
        
        # Add timeout
        result = await asyncio.wait_for(
            call_gemini_api(query),
            timeout=Config.REQUEST_TIMEOUT
        )
        
        logger.info(
            "Query processed successfully", 
            query=query, 
            result_count=len(result),
            request_id=request_id
        )
        return result
        
    except asyncio.TimeoutError:
        logger.error("Query processing timeout", query=query, request_id=request_id)
        return []
    except Exception as e:
        logger.error("Query processing failed", error=str(e), query=query, request_id=request_id)
        return []

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    )

@app.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """Readiness check endpoint"""
    try:
        # Quick test of Gemini client
        if gemini_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - Gemini client not initialized"
            )
        
        return HealthResponse(
            status="ready",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        )
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service not ready"
        )

# Main endpoint
@app.post(
    "/optimize-queries",
    response_model=QueryResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"}
    }
)
async def optimize_queries(request: QueryRequest, http_request: Request):
    """
    Optimize multiple search queries concurrently using Gemini AI.
    
    Processes up to 10 queries in parallel with proper error handling,
    timeouts, and retry logic.
    """
    request_id = http_request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")
    
    try:
        if gemini_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service unavailable - Gemini client not initialized"
            )
        
        # Process all queries concurrently
        tasks = [
            process_single_query(query, request_id) 
            for query in request.queries
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=False)
        
        # Flatten results
        optimized_queries = [item for sublist in results for item in sublist]
        
        logger.info(
            "Batch processing completed",
            input_count=len(request.queries),
            output_count=len(optimized_queries),
            request_id=request_id
        )
        
        return QueryResponse(
            results=optimized_queries,
            processed_count=len(optimized_queries),
            request_id=request_id
        )
        
    except Exception as e:
        logger.error("Batch processing failed", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process queries"
        )

if __name__ == "__main__":
    setup_logging()
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_config=None,  # Use our custom logging
        access_log=False,  # Handled by middleware
    )