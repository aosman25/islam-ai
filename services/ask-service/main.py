import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.genai import types
from pydantic import BaseModel

from models import AskRequest
from utils import build_prompt

# Import .env file
load_dotenv()


# Configuration
class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    MODEL = os.getenv("GEMINI_ASK_MODEL", "gemini-2.5-flash")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))
    SYSTEM_INSTRUCTION_PATH = os.getenv(
        "SYSTEM_INSTRUCTION_PATH", "system_instruction.txt"
    )

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY environment variable is required")
        if not os.path.exists(cls.SYSTEM_INSTRUCTION_PATH):
            raise ValueError(
                f"System instruction file not found: {cls.SYSTEM_INSTRUCTION_PATH}"
            )


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


# Models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str


# Global variables
gemini_client: Optional[genai.Client] = None
system_instruction: Optional[str] = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global gemini_client, system_instruction

    # Startup
    try:
        logger.info("Starting Ask Service")
        Config.validate()

        # Initialize Gemini client
        gemini_client = genai.Client(api_key=Config.GEMINI_API_KEY)
        logger.info("Gemini client initialized successfully")

        # Load system instruction
        with open(Config.SYSTEM_INSTRUCTION_PATH, "r", encoding="utf-8") as f:
            system_instruction = f.read()
        logger.info("System instruction loaded successfully")

        logger.info("Service started successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Ask Service")
        gemini_client = None
        system_instruction = None


# FastAPI app
app = FastAPI(
    title="Ask API",
    description="Production-ready API for streaming responses from Google's Gemini model",
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
        # Check if client is initialized
        if gemini_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - Gemini client not initialized",
            )

        if system_instruction is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - System instruction not loaded",
            )

        return HealthResponse(
            status="ready",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        )
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}",
        )


# Response model
class AskResponse(BaseModel):
    response: str
    request_id: str


# Main endpoint
@app.post(
    "/ask",
    response_model=AskResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
    },
)
async def ask(request: AskRequest, http_request: Request):
    """
    Generate response from Gemini model based on user input and sources.

    Generates a complete response using the provided query and sources with proper
    error handling.
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

        logger.info(
            "Processing ask request",
            query_length=len(request.query),
            sources_count=len(request.sources),
            temperature=request.temperature,
            request_id=request_id,
        )

        # Build prompt from request
        try:
            prompt = build_prompt(request)
        except Exception as e:
            logger.error("Error building prompt", error=str(e), request_id=request_id)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error building prompt: {str(e)}",
            )

        # Generate non-streaming response
        try:
            response = gemini_client.models.generate_content(
                model=Config.MODEL,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    temperature=request.temperature,
                    system_instruction=system_instruction,
                    max_output_tokens=request.max_tokens,
                ),
            )

            # Extract text from response
            response_text = ""

            # Try to get text from response
            try:
                if hasattr(response, "text") and response.text:
                    response_text = response.text
                elif hasattr(response, "candidates") and response.candidates:
                    # Extract from candidates if response.text is not available
                    for candidate in response.candidates:
                        if hasattr(candidate, "content") and candidate.content:
                            if (
                                hasattr(candidate.content, "parts")
                                and candidate.content.parts
                            ):
                                for part in candidate.content.parts:
                                    if hasattr(part, "text") and part.text:
                                        response_text += part.text
            except Exception as e:
                logger.error(
                    "Error extracting response text",
                    error=str(e),
                    error_type=type(e).__name__,
                    request_id=request_id,
                )

            # Log response details for debugging
            finish_reason = None
            if hasattr(response, "candidates") and response.candidates:
                finish_reason = getattr(response.candidates[0], "finish_reason", None)

            logger.info(
                "Received response from Gemini",
                has_text=bool(response_text),
                response_length=len(response_text) if response_text else 0,
                finish_reason=str(finish_reason) if finish_reason else None,
                request_id=request_id,
            )

            if not response_text:
                logger.error(
                    "Empty response from Gemini",
                    response_repr=str(response)[:1000],
                    finish_reason=str(finish_reason) if finish_reason else None,
                    request_id=request_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Received empty response from AI model. Finish reason: {finish_reason}",
                )

            logger.info(
                "Ask request completed",
                response_length=len(response_text),
                request_id=request_id,
            )

            return AskResponse(
                response=response_text,
                request_id=request_id,
            )

        except Exception as e:
            logger.error("Generation error", error=str(e), request_id=request_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate response: {str(e)}",
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Ask request failed", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process ask request",
        )


if __name__ == "__main__":
    setup_logging()
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=2000,
        log_config=None,  # Use our custom logging
        access_log=False,  # Handled by middleware
    )
