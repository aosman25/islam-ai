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
import json
import uvicorn
from urllib.parse import quote
from pydantic import BaseModel
from utils import *


# Configuration
class Config:
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    PORT = int(os.getenv("PORT", "3000"))


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
    logger.info("Starting Match Service")
    logger.info("Service started successfully")
    yield
    # Shutdown
    logger.info("Shutting down Match Service")


# FastAPI app
app = FastAPI(
    title="Match API",
    description="Production-ready API for matching book chunks to page ranges using fuzzy matching",
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
    return HealthResponse(
        status="ready",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    )


@app.post("/match")
async def match_books(
    book_zip: UploadFile = File(...),
    threshold: float = 65,
    request: Request = None,
    fast_match: bool = True,
):
    request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}") if request else "unknown"

    logger.info(
        "Processing match request",
        filename=book_zip.filename,
        fast_match=fast_match,
        request_id=request_id,
    )

    if not book_zip.filename.endswith(".zip"):
        logger.warning(
            "Invalid file type",
            filename=book_zip.filename,
            request_id=request_id,
        )
        raise HTTPException(status_code=400, detail="ZIP file required")
    
    if threshold < 0 or threshold > 100:
        logger.warning(
            "Invalid threshold value",
            filename=book_zip.filename,
            request_id=request_id,
        )
        raise HTTPException(status_code=400, detail="Threshold Value must be between 0 and 100")


    logger.info("Reading ZIP file", request_id=request_id)
    zip_bytes = await book_zip.read()

    book_chunks = None
    book_metadata = None
    original_files = {}

    logger.info("Extracting files from ZIP", request_id=request_id)
    with zipfile.ZipFile(BytesIO(zip_bytes), "r") as z:
        for name in z.namelist():
            content = z.read(name)
            original_files[name] = content

            if name.endswith(".chunks.json"):
                book_chunks = json.loads(
                    content.decode("utf-8", errors="ignore")
                )
            elif name.endswith(".json"):
                book_metadata = json.loads(
                    content.decode("utf-8", errors="ignore")
                )

    if not book_chunks or not book_metadata:
        missing_files = []
        if not book_chunks:
            missing_files.append("*.chunks.json")
        if not book_metadata:
            missing_files.append("*.json (metadata)")

        error_detail = f"Missing required files in ZIP: {', '.join(missing_files)}"

        logger.error(
            "Missing required files in ZIP",
            has_chunks=bool(book_chunks),
            has_metadata=bool(book_metadata),
            missing_files=missing_files,
            request_id=request_id,
        )
        raise HTTPException(status_code=400, detail=error_detail)

    logger.info(
        "Files extracted successfully",
        file_count=len(original_files),
        chunks_count=len(book_chunks) if book_chunks else 0,
        request_id=request_id,
    )

    if not isinstance(book_chunks, list) or len(book_chunks) == 0:
        logger.error(
            "Invalid or empty chunks array",
            chunks_type=type(book_chunks).__name__,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid chunks file: chunks array is empty or malformed"
        )

    book_name = book_metadata.get("book_name", "book")

    logger.info(
        "Book metadata extracted",
        book_name=book_name,
        request_id=request_id,
    )

    logger.info("Loading raw book pages", request_id=request_id)

    if "headers" not in book_metadata or "pages" not in book_metadata:
        logger.error(
            "Invalid book metadata structure",
            has_headers="headers" in book_metadata,
            has_pages="pages" in book_metadata,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid book metadata: missing 'headers' or 'pages' fields"
        )

    page_texts, pages_total_length = load_raw_book(book_metadata)

    if not page_texts or len(page_texts) == 0:
        logger.error(
            "No pages found in book metadata",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=400,
            detail="Invalid book metadata: no pages found in the book structure"
        )


    logger.info(
        "Starting matching process",
        total_chunks=len(book_chunks),
        total_pages=len(page_texts),
        request_id=request_id,
    )

    chunk_lengths = []
    chunks_total_length = 0

    for i in range(len(book_chunks)):
        chunk_lengths.append(len(clean_arabic_text(book_chunks[i]["text"])))
        chunks_total_length += chunk_lengths[-1]

    if chunks_total_length != pages_total_length:
        raise  HTTPException(
            status_code=400,
            detail=f"Lengths must be equal. Pages Length: {pages_total_length} Chunks Length: {chunks_total_length}"
        )

    chunk_pointer, page_pointer = 0, 0
    start_page = page_texts[0][0]
    curr_headers = []
    matching_logs = []

    while page_pointer < len(page_texts) and chunk_pointer < len(book_chunks):
        c_length = chunk_lengths[chunk_pointer]
        page_num, header_title, p_length = page_texts[page_pointer]

        if header_title not in curr_headers:
            curr_headers.append(header_title)


        # Log this iteration
        iteration_log = {
            "iteration": len(matching_logs),
            "chunk_pointer": chunk_pointer,
            "page_pointer": page_pointer,
            "page_number": page_num,
        }
        
        matching_logs.append(iteration_log)
        if p_length < c_length:
            page_texts[page_pointer][2] = 0
            chunk_lengths[chunk_pointer] -= p_length
            page_pointer += 1
        elif p_length > c_length:
            book_chunks[chunk_pointer]["page_range"] = [start_page, page_num]
            book_chunks[chunk_pointer]["header_titles"] = curr_headers
            curr_headers = []
            start_page = page_num
            chunk_lengths[chunk_pointer] = 0
            page_texts[page_pointer][2] -= c_length
            chunk_pointer += 1
        else:
            book_chunks[chunk_pointer]["page_range"] = [start_page, page_num]
            book_chunks[chunk_pointer]["header_titles"] = curr_headers
            curr_headers = []
            chunk_lengths[chunk_pointer] = 0
            page_texts[page_pointer][2] = 0
            page_pointer += 1
            chunk_pointer += 1
            if page_pointer < len(page_texts):
                start_page = page_texts[page_pointer][0]

    logger.info(
        "Matching loop completed",
        chunk_pointer=chunk_pointer,
        page_pointer=page_pointer,
        request_id=request_id,
    )

    if len(page_texts) - 1 <= page_pointer <= len(page_texts) and len(book_chunks) - 1 <= chunk_pointer <= len(book_chunks):
        for i in range(chunk_pointer, len(book_chunks)):
            if "page_range" not in book_chunks[i]:
                _, end_page = book_chunks[i - 1]["page_range"]
                header_titles = book_chunks[i - 1]["header_titles"]
                book_chunks[i]["page_range"] = [end_page, end_page]
                book_chunks[i]["header_titles"] = header_titles

        logger.info(
            "Matching completed successfully",
            matched_chunks=len(book_chunks),
            request_id=request_id,
        )
    
    else:
        matched_count = chunk_pointer
        total_count = len(book_chunks)
        unmatched_count = total_count - matched_count
        current_page = page_texts[page_pointer][0] if page_pointer < len(page_texts) else "N/A"
        total_pages = len(page_texts)

        error_detail = {
            "debug_info": {
                "book_name": book_name,
                "total_chunks": total_count,
                "matched_chunks": matched_count,
                "unmatched_chunks": unmatched_count,
                "page_pointer": page_pointer,
                "chunk_pointer": chunk_pointer,
                "current_page": current_page,
                "total_pages": total_pages,
                "total_iterations": len(matching_logs)
            },
            "matching_logs": matching_logs
        }

        raise HTTPException(
            status_code=500,
            detail=error_detail,
        )

    # -------- ZIP OUTPUT --------

    logger.info("Building output ZIP", request_id=request_id)
    output_zip = BytesIO()
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for filename, content in original_files.items():
            z.writestr(filename, content)

        match_filename = f"{book_name}.match.json"
        z.writestr(
            match_filename,
            json.dumps(book_chunks, ensure_ascii=False, indent=2),
        )

    output_zip.seek(0)
    zip_size = len(output_zip.getvalue())

    logger.info(
        "Match request completed successfully",
        book_name=book_name,
        matched_chunks=len(book_chunks),
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
