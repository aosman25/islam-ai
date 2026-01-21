"""FastAPI application for Books DB API (Read-Only)."""

import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import Optional

import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from models import (
    HealthResponse, ErrorResponse, PaginationMeta,
    CategoryResponse, CategoryListResponse,
    AuthorResponse, AuthorWithBooksResponse, AuthorListResponse,
    BookResponse, BookListResponse, BookSummaryResponse,
    ExportRequest, ExportWithMetadataResponse, ExportedBookResult
)

# Default pagination settings
DEFAULT_LIMIT = 50
MAX_LIMIT = 500
from utils import DatabaseService, ExportService

# Load environment variables
load_dotenv()


# Configuration
class Config:
    DATABASE_PATH = os.getenv("DATABASE_PATH", "shamela_metadata.db")
    BASE_DIR = os.getenv("BASE_DIR", os.path.dirname(os.path.abspath(__file__)))
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    PORT = int(os.getenv("PORT", "4000"))
    ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "")

    # S3/Backblaze B2 configuration
    S3_ENDPOINT = os.getenv("S3_ENDPOINT", "")
    S3_ACCESS_KEY = os.getenv("S3_ACCESS_KEY", "")
    S3_SECRET_KEY = os.getenv("S3_SECRET_KEY", "")
    S3_BUCKET = os.getenv("S3_BUCKET", "islamic-library")

    @classmethod
    def validate(cls):
        """Validate required configuration."""
        db_path = os.path.join(cls.BASE_DIR, cls.DATABASE_PATH)
        if not os.path.exists(db_path):
            raise ValueError(f"Database not found: {db_path}")


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


# Global services
db_service: Optional[DatabaseService] = None
export_service: Optional[ExportService] = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global db_service, export_service

    try:
        logger.info("Starting Books DB Service")
        Config.validate()

        # Initialize services
        db_path = os.path.join(Config.BASE_DIR, Config.DATABASE_PATH)
        db_service = DatabaseService(db_path)
        export_service = ExportService(
            base_dir=Config.BASE_DIR,
            s3_endpoint=Config.S3_ENDPOINT or None,
            s3_access_key=Config.S3_ACCESS_KEY or None,
            s3_secret_key=Config.S3_SECRET_KEY or None,
            s3_bucket=Config.S3_BUCKET
        )

        logger.info("Services initialized successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        logger.info("Shutting down Books DB Service")
        db_service = None
        export_service = None


# FastAPI app
app = FastAPI(
    title="Books DB API",
    description="Read-only API for Shamela library metadata and book exports",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware
if Config.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=Config.ALLOWED_ORIGINS.split(","),
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )


# Request logging middleware
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
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


# ============== Health Endpoints ==============

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    )


@app.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """Readiness check endpoint - verifies database connection."""
    try:
        if db_service is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database service not initialized"
            )

        # Test database connection
        db_service.get_all_categories()

        return HealthResponse(
            status="ready",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}"
        )


# ============== Category Endpoints (Read-Only) ==============

@app.get("/categories", response_model=CategoryListResponse)
async def list_categories(
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Get all categories with pagination."""
    categories, total = db_service.get_all_categories(limit=limit, offset=offset)
    return CategoryListResponse(
        categories=[CategoryResponse(**c) for c in categories],
        count=len(categories),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(categories)) < total
        )
    )


@app.get("/categories/search", response_model=CategoryListResponse)
async def search_categories(
    q: str = Query(..., min_length=1),
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Search categories by name with pagination."""
    categories, total = db_service.search_categories(q, limit=limit, offset=offset)
    return CategoryListResponse(
        categories=[CategoryResponse(**c) for c in categories],
        count=len(categories),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(categories)) < total
        )
    )


@app.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: int):
    """Get a single category by ID."""
    category = db_service.get_category(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryResponse(**category)


# ============== Author Endpoints (Read-Only) ==============

@app.get("/authors", response_model=AuthorListResponse)
async def list_authors(
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Get all authors with pagination."""
    authors, total = db_service.get_all_authors(limit=limit, offset=offset)
    return AuthorListResponse(
        authors=[AuthorResponse(**a) for a in authors],
        count=len(authors),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(authors)) < total
        )
    )


@app.get("/authors/search", response_model=AuthorListResponse)
async def search_authors(
    q: str = Query(..., min_length=1),
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Search authors by name with pagination."""
    authors, total = db_service.search_authors(q, limit=limit, offset=offset)
    return AuthorListResponse(
        authors=[AuthorResponse(**a) for a in authors],
        count=len(authors),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(authors)) < total
        )
    )


@app.get("/authors/{author_id}", response_model=AuthorWithBooksResponse)
async def get_author(author_id: int):
    """Get a single author by ID with their books."""
    author = db_service.get_author(author_id)
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    books = db_service.get_author_books(author_id)
    return AuthorWithBooksResponse(
        **author,
        books=[BookSummaryResponse(**b) for b in books]
    )


# ============== Book Endpoints (Read-Only) ==============

@app.get("/books", response_model=BookListResponse)
async def list_books(
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Get all books with pagination."""
    books, total = db_service.get_all_books(limit=limit, offset=offset)
    return BookListResponse(
        books=[BookResponse(**b) for b in books],
        count=len(books),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(books)) < total
        )
    )


@app.get("/books/search", response_model=BookListResponse)
async def search_books(
    q: Optional[str] = Query(None, min_length=1),
    category_id: Optional[int] = None,
    author_id: Optional[int] = None,
    hidden: Optional[int] = None,
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Search books by name, category, or author with pagination."""
    books, total = db_service.search_books(q, category_id, author_id, hidden, limit=limit, offset=offset)
    return BookListResponse(
        books=[BookResponse(**b) for b in books],
        count=len(books),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(books)) < total
        )
    )


@app.get("/books/by-category/{category_id}", response_model=BookListResponse)
async def get_books_by_category(
    category_id: int,
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Get all books in a category with pagination."""
    books, total = db_service.get_books_by_category(category_id, limit=limit, offset=offset)
    return BookListResponse(
        books=[BookResponse(**b) for b in books],
        count=len(books),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(books)) < total
        )
    )


@app.get("/books/by-author/{author_id}", response_model=BookListResponse)
async def get_books_by_author(
    author_id: int,
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Get all books by an author with pagination."""
    books, total = db_service.get_books_by_author(author_id, limit=limit, offset=offset)
    return BookListResponse(
        books=[BookResponse(**b) for b in books],
        count=len(books),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(books)) < total
        )
    )


@app.get("/books/{book_id}", response_model=BookResponse)
async def get_book(book_id: int):
    """Get a single book by ID."""
    book = db_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return BookResponse(**book)


# ============== Export Endpoints ==============

@app.get("/export/list", response_model=BookListResponse)
async def list_exportable_books(
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """List all books available for export with pagination."""
    books, total = db_service.get_all_books(limit=limit, offset=offset)
    return BookListResponse(
        books=[BookResponse(**b) for b in books],
        count=len(books),
        pagination=PaginationMeta(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + len(books)) < total
        )
    )


@app.post("/export/books", response_model=ExportWithMetadataResponse)
async def export_books(request: ExportRequest):
    """
    Export multiple books: upload raw HTML files and generate metadata.

    This endpoint combines the previous export and process functionality:
    - Exports raw HTML files to S3 (if not already there)
    - Generates and uploads metadata JSON (if not already there)

    Optimizations:
    - Early exit for already exported books (skips work entirely)
    - Concurrent processing for unprocessed books (up to 5 at a time)
    - Streaming HTML download to reduce memory usage
    """
    # Verify all books exist and gather their data
    books_data = {}
    for book_id in request.book_ids:
        book = db_service.get_book(book_id)
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
        books_data[book_id] = book

    # Early exit check: find already exported books
    export_status = export_service.check_books_export_status_batch(request.book_ids)

    results = []
    books_to_export = []

    for book_id in request.book_ids:
        raw_files_count, metadata_url = export_status.get(book_id, (None, None))
        if raw_files_count and metadata_url:
            # Book already exported - add to results immediately
            results.append(ExportedBookResult(
                book_id=book_id,
                raw_files_count=raw_files_count,
                metadata_url=metadata_url
            ))
            logger.info("Book already exported, skipping", book_id=book_id)
        else:
            # Book needs exporting
            book = books_data[book_id]
            books_to_export.append({
                "book_id": book_id,
                "book_name": book.get("book_name"),
                "author_name": book.get("author_name"),
                "category_name": book.get("category_name"),
                "table_of_contents": book.get("table_of_contents")
            })

    # Export unprocessed books concurrently
    if books_to_export:
        logger.info("Exporting books concurrently", count=len(books_to_export))
        batch_results = await export_service.export_books_batch(
            books_data=books_to_export,
            max_concurrent=5
        )

        # Check for errors and build results
        errors = []
        for book_id, raw_files_count, metadata_url, error in batch_results:
            if error:
                errors.append(f"Book {book_id}: {error}")
            else:
                results.append(ExportedBookResult(
                    book_id=book_id,
                    raw_files_count=raw_files_count,
                    metadata_url=metadata_url
                ))

        if errors:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to export some books: {'; '.join(errors)}"
            )

    # Sort results by original request order
    book_id_order = {book_id: idx for idx, book_id in enumerate(request.book_ids)}
    results.sort(key=lambda r: book_id_order.get(r.book_id, 999999))

    already_exported = len(request.book_ids) - len(books_to_export)
    message = f"Exported {len(results)} book(s) successfully"
    if already_exported > 0:
        message += f" ({already_exported} already exported, {len(books_to_export)} newly exported)"

    return ExportWithMetadataResponse(
        book_ids=request.book_ids,
        results=results,
        message=message,
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    )


@app.post("/export/books/{book_id}", response_model=ExportWithMetadataResponse)
async def export_single_book(book_id: int):
    """
    Export a single book: upload raw HTML files and generate metadata.

    This endpoint combines the previous export and process functionality:
    - Exports raw HTML files to S3 (if not already there)
    - Generates and uploads metadata JSON (if not already there)
    """
    book = db_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Early exit check
    raw_files_count, metadata_url = export_service.check_export_status(book_id)
    if raw_files_count and metadata_url:
        logger.info("Book already exported, returning cached data", book_id=book_id)
        return ExportWithMetadataResponse(
            book_ids=[book_id],
            results=[ExportedBookResult(
                book_id=book_id,
                raw_files_count=raw_files_count,
                metadata_url=metadata_url
            )],
            message="Book already exported",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        )

    try:
        raw_files_count, metadata_url = export_service.export_book_with_metadata(
            book_id=book_id,
            book_name=book.get("book_name"),
            author_name=book.get("author_name"),
            category_name=book.get("category_name"),
            table_of_contents=book.get("table_of_contents")
        )

        return ExportWithMetadataResponse(
            book_ids=[book_id],
            results=[ExportedBookResult(
                book_id=book_id,
                raw_files_count=raw_files_count,
                metadata_url=metadata_url
            )],
            message="Book exported successfully",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        )
    except Exception as e:
        logger.error("Export failed", error=str(e), book_id=book_id)
        raise HTTPException(status_code=500, detail=str(e))


# ============== Download Endpoints ==============

@app.get("/download/books/{book_id}")
async def download_single_book(book_id: int):
    """Download a single book as a zip file."""
    if not db_service.get_book(book_id):
        raise HTTPException(status_code=404, detail="Book not found")

    # Check if book exists in S3
    if not export_service.book_exists_in_s3(book_id):
        raise HTTPException(
            status_code=404,
            detail="Book not exported yet. Use /export/books/{book_id} first."
        )

    try:
        zip_buffer, filename = export_service.download_books_as_zip([book_id])
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error("Download failed", error=str(e), book_id=book_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download/books")
async def download_multiple_books(request: ExportRequest):
    """Download multiple books as a zip file."""
    # Verify all books exist in database
    for book_id in request.book_ids:
        if not db_service.get_book(book_id):
            raise HTTPException(
                status_code=404,
                detail=f"Book {book_id} not found"
            )

    # Check which books exist in S3
    missing_books = []
    for book_id in request.book_ids:
        if not export_service.book_exists_in_s3(book_id):
            missing_books.append(book_id)

    if missing_books:
        raise HTTPException(
            status_code=404,
            detail=f"Books not exported yet: {missing_books}. Use /export/books first."
        )

    try:
        zip_buffer, filename = export_service.download_books_as_zip(request.book_ids)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error("Download failed", error=str(e), book_ids=request.book_ids)
        raise HTTPException(status_code=500, detail=str(e))


# ============== Metadata Download Endpoints ==============

@app.get("/download/metadata/{book_id}")
async def download_single_metadata(book_id: int):
    """Download metadata file for a single book."""
    if not db_service.get_book(book_id):
        raise HTTPException(status_code=404, detail="Book not found")

    if not export_service.get_processed_metadata_url(book_id):
        raise HTTPException(
            status_code=404,
            detail="Metadata not available. Use /export/books/{book_id} first."
        )

    try:
        zip_buffer, filename = export_service.download_metadata_as_zip([book_id])
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error("Download metadata failed", error=str(e), book_id=book_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download/metadata")
async def download_multiple_metadata(request: ExportRequest):
    """Download metadata files for multiple books."""
    # Verify all books exist and are exported
    missing_metadata = []
    for book_id in request.book_ids:
        if not db_service.get_book(book_id):
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
        if not export_service.get_processed_metadata_url(book_id):
            missing_metadata.append(book_id)

    if missing_metadata:
        raise HTTPException(
            status_code=404,
            detail=f"Metadata not available for books: {missing_metadata}. Use /export/books first."
        )

    try:
        zip_buffer, filename = export_service.download_metadata_as_zip(request.book_ids)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error("Download metadata failed", error=str(e), book_ids=request.book_ids)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    setup_logging()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        reload=True,
        port=Config.PORT,
        log_config=None,
        access_log=False,
    )
