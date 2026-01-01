import logging
import os
import sys
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, UploadFile, File, HTTPException, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
import zipfile
from io import BytesIO
from dotenv import load_dotenv
import json
import uvicorn
from pydantic import BaseModel
from encoders import DeepInfraEncoder
from semantic_chunkers import StatisticalChunker
import uuid
from urllib.parse import quote

load_dotenv()


# Configuration
class Config:
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    PORT = int(os.getenv("PORT", "3000"))
    DEEPINFRA_API_KEY = os.getenv("DEEPINFRA_API_KEY")

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


# Models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str


# Global logger
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup
    try:
        logger.info("Starting Split Service")
        Config.validate()
        logger.info("Configuration validated successfully")
        logger.info("Service started successfully")
        yield
    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Split Service")


# FastAPI app
app = FastAPI(
    title="Split API",
    description="Production-ready API for semantic text chunking using statistical methods",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# Middleware
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


# Health check endpoints
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
        # Check if API key is configured
        if not Config.DEEPINFRA_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - DeepInfra API key not configured",
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


@app.post("/split")
async def split_semantic_text(
    book_zip: UploadFile = File(...),
    request: Request = None,
    deepinfra_api_key: str = os.getenv("DEEPINFRA_API_KEY"),
    model_name: str = "BAAI/bge-m3-multi",
    min_split_tokens: int = 1000,
    max_split_tokens: int = 5000,
    split_tokens_tolerance: int = 0,
):
    request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}") if request else "unknown"

    logger.info(
        "Processing split request",
        filename=book_zip.filename,
        model_name=model_name,
        min_split_tokens=min_split_tokens,
        max_split_tokens=max_split_tokens,
        request_id=request_id,
    )

    if not book_zip.filename.endswith(".zip"):
        logger.warning(
            "Invalid file type",
            filename=book_zip.filename,
            request_id=request_id,
        )
        raise HTTPException(status_code=400, detail="ZIP file required")

    logger.info("Reading ZIP file", request_id=request_id)
    zip_bytes = await book_zip.read()

    book_text = None
    book_metadata = None
    original_files = {}

    logger.info("Extracting files from ZIP", request_id=request_id)
    with zipfile.ZipFile(BytesIO(zip_bytes), "r") as z:
        for name in z.namelist():
            content = z.read(name)
            original_files[name] = content

            if name.endswith(".md"):
                book_text = content.decode("utf-8", errors="ignore")

            elif name.endswith(".json"):
                book_metadata = json.loads(
                    content.decode("utf-8", errors="ignore")
                )

    if not book_text or not book_metadata:
        logger.error(
            "Missing required files in ZIP",
            has_text=bool(book_text),
            has_metadata=bool(book_metadata),
            request_id=request_id,
        )
        raise HTTPException(status_code=400, detail="Missing required files")

    logger.info(
        "Files extracted successfully",
        file_count=len(original_files),
        text_length=len(book_text),
        request_id=request_id,
    )

    book_name = book_metadata.get("book_name", "book")
    book_id = book_metadata.get("book_id", "")
    knowledge = book_metadata.get("knowledge", "")
    category = book_metadata.get("category", "")
    author = book_metadata.get("author", "")

    logger.info(
        "Book metadata extracted",
        book_name=book_name,
        book_id=book_id,
        author=author,
        request_id=request_id,
    )

    logger.info(
        "Initializing encoder",
        model_name=model_name,
        request_id=request_id,
    )
    encoder = DeepInfraEncoder(
        deepinfra_api_key=deepinfra_api_key,
        name=model_name,
    )

    logger.info(
        "Initializing chunker",
        min_split_tokens=min_split_tokens,
        max_split_tokens=max_split_tokens,
        request_id=request_id,
    )
    chunker = StatisticalChunker(
        encoder=encoder,
        min_split_tokens=min_split_tokens,
        max_split_tokens=max_split_tokens,
        split_tokens_tolerance=split_tokens_tolerance,
        enable_statistics=False,
    )

    logger.info("Starting chunking process", request_id=request_id)
    chunks = chunker(docs=[book_text])
    logger.info("Chunking completed", request_id=request_id)

    logger.info("Processing chunks", request_id=request_id)
    all_chunks = []
    for chunk_list in chunks:
        for chunk in chunk_list:
            all_chunks.append({
                "id": str(uuid.uuid4()),
                "book_id": book_id,
                "book_name": book_name,
                "order": len(all_chunks),
                "author": author,
                "knowledge": knowledge,
                "category": category,
                "text": " ".join(chunk.splits),
            })

    logger.info(
        "Chunks processed successfully",
        total_chunks=len(all_chunks),
        request_id=request_id,
    )

    logger.info("Building output ZIP", request_id=request_id)
    output_zip = BytesIO()
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for filename, content in original_files.items():
            z.writestr(filename, content)

        chunks_filename = f"{book_name}.chunks.json"
        z.writestr(
            chunks_filename,
            json.dumps(all_chunks, ensure_ascii=False, indent=2),
        )

    output_zip.seek(0)
    zip_size = len(output_zip.getvalue())

    logger.info(
        "Split request completed successfully",
        book_name=book_name,
        total_chunks=len(all_chunks),
        zip_size_bytes=zip_size,
        request_id=request_id,
    )

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
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=Config.PORT,
        log_config=None,  # Use our custom logging
        access_log=False,  # Handled by middleware
    )
