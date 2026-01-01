import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List
import structlog
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from collections import defaultdict
from bs4 import BeautifulSoup
from urllib.parse import quote
from io import BytesIO
from pydantic import BaseModel
import pandas as pd
import uuid
import zipfile
import json
import uvicorn
import re

from utils import (
    ends_with_punctuation,
    starts_with_letter,
    extract_optional_metadata,
    extract_text_from_page,
    arabic_to_english_numerals,
)


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
    logger.info("Starting Scrape Service")
    logger.info("Service started successfully")
    yield
    # Shutdown
    logger.info("Shutting down Scrape Service")


# FastAPI app
app = FastAPI(
    title="Scrape API",
    description="Production-ready API for scraping and processing AlShamela books",
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


@app.post("/scrape")
async def scrape_book_htms(
    htm_files: List[UploadFile] = File(...),
    book_name: str = Form(...),
    csv_file: UploadFile = File(...),
    request: Request = None,
):
    request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}") if request else "unknown"

    logger.info(
        "Processing scrape request",
        book_name=book_name,
        htm_files_count=len(htm_files),
        request_id=request_id,
    )

    # Validate HTML files
    for file in htm_files:
        if not file.filename.lower().endswith((".htm", ".html")):
            logger.warning(
                "Invalid file type",
                filename=file.filename,
                request_id=request_id,
            )
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.filename}",
            )

    logger.info("HTML files validated successfully", request_id=request_id)

    # Read and decode HTML files once
    decoded_htm_files = [
        upload.file.read().decode("utf-8", errors="ignore")
        for upload in htm_files
    ]

    logger.info("HTML files decoded successfully", request_id=request_id)

    # Read metadata CSV
    metadata = pd.read_csv(csv_file.file)
    metadata = metadata.set_index("الكتاب")

    if book_name not in metadata.index:
        logger.error(
            "Metadata not found for book",
            book_name=book_name,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=400,
            detail=f"Metadata not found for book: {book_name}",
        )

    knowledge = metadata.loc[book_name, "العلم الشرعي"]
    category = metadata.loc[book_name, "التصنيف"]
    author = metadata.loc[book_name, "المؤلف"]
    book_id = str(uuid.uuid4())

    logger.info(
        "Metadata extracted successfully",
        book_id=book_id,
        author=author,
        request_id=request_id,
    )

    full_text = ""
    previous_text = ""
    optional_metadata = {}
    headers = []
    headers_set = set()
    pages = defaultdict(lambda: defaultdict(list))

    # Extract optional metadata from first valid HTML
    logger.info("Extracting optional metadata", request_id=request_id)
    for html in decoded_htm_files:
        soup = BeautifulSoup(html, "html5lib")
        optional_metadata = extract_optional_metadata(soup)
        if optional_metadata:
            break

    logger.info("Optional metadata extracted", request_id=request_id)

    # Process pages
    logger.info("Processing pages", request_id=request_id)
    for html in decoded_htm_files:
        soup = BeautifulSoup(html, "html5lib")
        main_div = soup.find("div", class_="Main")
        if not main_div:
            continue

        page_divs = main_div.find_all("div", class_="PageText")
        for page in page_divs:
            current_text = extract_text_from_page(page)
            if not current_text or not current_text.strip():
                continue

            page_head = page.find("div", class_="PageHead")
            page_title = ""
            page_number = None

            if page_head:
                part_name_span = page_head.find("span", class_="PartName")
                if part_name_span:
                    page_title = part_name_span.get_text(strip=True)

                page_num_span = page_head.find("span", class_="PageNumber")
                if page_num_span:
                    match = re.search(r"ص:\s*([٠-٩\d]+)", page_num_span.get_text())
                    if match:
                        try:
                            page_number = int(
                                arabic_to_english_numerals(match.group(1))
                            )
                        except Exception:
                            pass

            if page_title not in headers_set:
                headers_set.add(page_title)
                headers.append(page_title)

            pages[page_title][page_number].append(
                {
                    "header_title": page_title,
                    "page_num": page_number,
                    "cleaned_text": current_text,
                    "display_elem": str(page),
                }
            )

            if (
                previous_text
                and not ends_with_punctuation(previous_text)
                and starts_with_letter(current_text)
            ):
                full_text = full_text.rstrip() + " " + current_text.lstrip()
            else:
                full_text += "\n\n" + current_text.strip()

            previous_text = current_text

    logger.info(
        "Pages processed successfully",
        total_headers=len(headers),
        total_pages=sum(len(pages[h]) for h in pages),
        request_id=request_id,
    )

    # Normalize whitespace
    full_text = re.sub(r"\n{3,}", "\n\n", full_text).strip()

    logger.info(
        "Full text prepared",
        text_length=len(full_text),
        request_id=request_id,
    )

    # JSON metadata without full_text
    book_info = {
        "book_id": book_id,
        "book_name": book_name,
        "author": author,
        "knowledge": knowledge,
        "category": category,
        "headers": headers,
        **optional_metadata,
        "pages": pages,
    }

    # Build ZIP in memory
    logger.info("Building ZIP file", request_id=request_id)
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr(
            f"{book_name}.md",
            full_text,
        )
        zipf.writestr(
            f"{book_name}.json",
            json.dumps(book_info, ensure_ascii=False, indent=2),
        )

    zip_buffer.seek(0)
    zip_size = len(zip_buffer.getvalue())

    logger.info(
        "Scrape request completed successfully",
        book_name=book_name,
        zip_size_bytes=zip_size,
        request_id=request_id,
    )

    # RFC 5987 safe filename handling
    ascii_fallback = "book.zip"
    utf8_filename = quote(f"{book_name}.zip")

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_fallback}"; '
                f"filename*=UTF-8''{utf8_filename}"
            )
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
