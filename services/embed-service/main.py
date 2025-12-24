import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List, Optional
import httpx
import structlog
from fastapi import FastAPI, HTTPException, Request, status, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from dotenv import load_dotenv
from utils import convert_to_milvus_sparse_format
from models import EmbeddingRequest, EmbeddingResponseModel, HealthResponse, ErrorResponse
import zipfile
from io import BytesIO
import json
from urllib.parse import quote


# Import .env file
load_dotenv()


# Configuration
class Config:
    DEEPINFRA_API_KEY = os.getenv("DEEPINFRA_API_KEY")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    MAX_TEXTS_PER_REQUEST = int(os.getenv("MAX_TEXTS_PER_REQUEST", "10"))
    MAX_TEXT_LENGTH = int(os.getenv("MAX_TEXT_LENGTH", "8000"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3-multi")
    DEEPINFRA_API_URL = f"https://api.deepinfra.com/v1/inference/{os.getenv('EMBEDDING_MODEL', 'BAAI/bge-m3-multi')}"

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.DEEPINFRA_API_KEY:
            raise ValueError("DEEPINFRA_API_KEY environment variable is required")


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
http_client = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global http_client

    # Startup
    try:
        logger.info("Starting Embedding Service")
        Config.validate()

        # Initialize HTTP client with timeout
        timeout = httpx.Timeout(Config.REQUEST_TIMEOUT)
        http_client = httpx.AsyncClient(timeout=timeout)

        # Test API connection
        await test_deepinfra_connection()

        logger.info("Service started successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Embedding Service")
        if http_client:
            await http_client.aclose()
        http_client = None


async def test_deepinfra_connection():
    """Test DeepInfra API connection during startup"""
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}",
        }
        payload = {"inputs": ["test"], "dense": True, "sparse": False, "colbert": False}

        response = await http_client.post(
            Config.DEEPINFRA_API_URL, headers=headers, json=payload
        )

        if response.status_code == 200:
            logger.info("DeepInfra API connection verified")
        else:
            logger.warning(
                "DeepInfra API test returned non-200 status",
                status_code=response.status_code,
            )
    except Exception as e:
        logger.error("Failed to connect to DeepInfra API", error=str(e))
        raise


# FastAPI app
app = FastAPI(
    title="Embedding API",
    description="Production-ready API for generating text embeddings using DeepInfra",
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


# Retry logic for DeepInfra API calls
@retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.HTTPStatusError)),
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    reraise=True,
)
async def call_deepinfra_api(
    input_texts: List[str], dense: bool, sparse: bool, colbert: bool
) -> dict:
    """Call DeepInfra API with retry logic"""
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {Config.DEEPINFRA_API_KEY}",
        }
        payload = {
            "inputs": input_texts,
            "dense": dense,
            "sparse": sparse,
            "colbert": colbert,
        }

        response = await http_client.post(
            Config.DEEPINFRA_API_URL, headers=headers, json=payload
        )

        if response.status_code != 200:
            logger.error(
                "DeepInfra API error",
                status_code=response.status_code,
                response=response.text,
            )
            response.raise_for_status()

        return response.json()

    except httpx.TimeoutException as e:
        logger.error("DeepInfra API timeout", error=str(e))
        raise
    except Exception as e:
        logger.error("DeepInfra API call failed", error=str(e))
        raise


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
        # Quick test of HTTP client
        if http_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - HTTP client not initialized",
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
    "/embed",
    response_model=EmbeddingResponseModel,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
        504: {"model": ErrorResponse, "description": "Request timeout"},
    },
)
async def get_embedding(request: EmbeddingRequest, http_request: Request):
    """
    Generate embeddings for input texts using DeepInfra API.

    Supports dense, sparse, and ColBERT embeddings with proper error handling,
    timeouts, and retry logic.
    """
    request_id = http_request.headers.get(
        "x-request-id", f"req_{int(time.time() * 1000)}"
    )

    try:
        if http_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service unavailable - HTTP client not initialized",
            )

        logger.info(
            "Processing embedding request",
            text_count=len(request.input_text),
            dense=request.dense,
            sparse=request.sparse,
            colbert=request.colbert,
            request_id=request_id,
        )

        # Call DeepInfra API
        raw_response = await call_deepinfra_api(
            request.input_text, request.dense, request.sparse, request.colbert
        )

        # Process response
        dense_embeddings = raw_response.get("embeddings", []) if request.dense else None
        sparse_embeddings = (
            convert_to_milvus_sparse_format(raw_response.get("sparse", []))
            if request.sparse
            else None
        )
        colbert_embeddings = (
            raw_response.get("colbert", []) if request.colbert else None
        )

        logger.info(
            "Embedding request completed",
            text_count=len(request.input_text),
            request_id=request_id,
        )

        return EmbeddingResponseModel(
            dense=dense_embeddings,
            sparse=sparse_embeddings,
            colbert=colbert_embeddings,
            processed_count=len(request.input_text),
            request_id=request_id,
        )

    except httpx.TimeoutException:
        logger.error("Request timeout", request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="DeepInfra request timed out",
        )
    except httpx.HTTPStatusError as e:
        logger.error("DeepInfra API error", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"DeepInfra request failed: {e.response.text}",
        )
    except Exception as e:
        logger.error("Embedding request failed", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process embedding request",
        )

@app.post("/embed-book")
async def embed_book(book_zip: UploadFile = File(...), batch_size: int = 50):
    if not book_zip.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="ZIP file required")

    zip_bytes = await book_zip.read()

    book_match = None
    book_metadata = None
    original_files = {}

    with zipfile.ZipFile(BytesIO(zip_bytes), "r") as z:
        for name in z.namelist():
            content = z.read(name)
            original_files[name] = content

            if name.endswith(".match.json"):
                book_match = json.loads(
                    content.decode("utf-8", errors="ignore")
                )

            elif name.endswith(".json") and not name.endswith(".chunks.json"):
                book_metadata = json.loads(
                    content.decode("utf-8", errors="ignore")
                )

    book_name = book_metadata["book_name"]

    if not book_match:
        raise HTTPException(status_code=400, detail="Missing required files")

    chunk_lines = []

    for i in range(0, len(book_match), batch_size):
        chunk_texts = [book_match[j]["text"] for j in range(i, i + batch_size) if j < len(book_match)]
        raw_response = await call_deepinfra_api(chunk_texts, True, True, False)
        dense_embeddings = raw_response.get("embeddings", [])
        sparse_embeddings = convert_to_milvus_sparse_format(raw_response.get("sparse", []))

        for j, dense, sparse in zip(range(i, i + batch_size), dense_embeddings, sparse_embeddings):
            chunk_lines.append(json.dumps({**book_match[j], "dense_vector": dense, "sparse_vector": sparse}, ensure_ascii=False))
    

    # -------- ZIP OUTPUT --------

    output_zip = BytesIO()
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for filename, content in original_files.items():
            z.writestr(filename, content)

        embed_filename = f"{book_name}.jsonl"
        z.writestr(
            embed_filename,
            "\n".join(chunk_lines),
        )

    output_zip.seek(0)

    safe_zip_name = quote(f"{book_name}.zip")

    return StreamingResponse(
        output_zip,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_zip_name}"
        },
    )

if __name__ == "__main__":
    setup_logging()
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=4000,
        log_config=None,  # Use our custom logging
        access_log=False,  # Handled by middleware
    )
