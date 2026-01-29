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
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from models import (
    HealthResponse, ErrorResponse, PaginationMeta,
    CategoryResponse, CategoryListResponse,
    AuthorResponse, AuthorWithBooksResponse, AuthorListResponse,
    BookResponse, BookListResponse, BookSummaryResponse,
    ExportRequest,
    DeleteResponse, DeleteBatchResponse,
    JobStatus, JobSubmitResponse, JobResponse, JobListResponse,
    DeadLetterListResponse,
)
from job_manager import JobManager

# Default pagination settings
DEFAULT_LIMIT = 50
MAX_LIMIT = 500
from utils import DatabaseService, ExportService
from postgres_service import PostgresService
from milvus_service import MilvusService

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

    # PostgreSQL configuration
    POSTGRES_HOST = os.getenv("POSTGRES_HOST", "")
    POSTGRES_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB = os.getenv("POSTGRES_DB", "books")
    POSTGRES_USER = os.getenv("POSTGRES_USER", "")
    POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "")

    # Milvus configuration
    MILVUS_URI = os.getenv("MILVUS_URI", "")
    MILVUS_TOKEN = os.getenv("MILVUS_TOKEN", "")
    MILVUS_COLLECTION = os.getenv("MILVUS_COLLECTION", "islamic_library")
    MILVUS_PARTITION = os.getenv("MILVUS_PARTITION", "_default")

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
postgres_service: Optional[PostgresService] = None
milvus_service: Optional[MilvusService] = None
job_manager: Optional[JobManager] = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    global db_service, export_service, postgres_service, milvus_service, job_manager

    try:
        logger.info("Starting Books DB Service")
        Config.validate()

        # Initialize PostgreSQL service (required)
        if not Config.POSTGRES_HOST or not Config.POSTGRES_USER or not Config.POSTGRES_PASSWORD:
            raise ValueError("PostgreSQL configuration is required: POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD")

        postgres_service = PostgresService(
            host=Config.POSTGRES_HOST,
            port=Config.POSTGRES_PORT,
            database=Config.POSTGRES_DB,
            user=Config.POSTGRES_USER,
            password=Config.POSTGRES_PASSWORD
        )
        logger.info("PostgreSQL service initialized", host=Config.POSTGRES_HOST, database=Config.POSTGRES_DB)

        # Initialize Milvus service (required)
        if not Config.MILVUS_URI:
            raise ValueError("Milvus configuration is required: MILVUS_URI")

        milvus_service = MilvusService(
            uri=Config.MILVUS_URI,
            token=Config.MILVUS_TOKEN or None,
            collection_name=Config.MILVUS_COLLECTION
        )
        milvus_service.connect()
        milvus_service.ensure_collection_exists()
        logger.info(
            "Milvus service initialized",
            uri=Config.MILVUS_URI,
            collection=Config.MILVUS_COLLECTION,
            partition=Config.MILVUS_PARTITION
        )

        # Initialize services
        db_path = os.path.join(Config.BASE_DIR, Config.DATABASE_PATH)
        db_service = DatabaseService(db_path)
        export_service = ExportService(
            base_dir=Config.BASE_DIR,
            s3_endpoint=Config.S3_ENDPOINT or None,
            s3_access_key=Config.S3_ACCESS_KEY or None,
            s3_secret_key=Config.S3_SECRET_KEY or None,
            s3_bucket=Config.S3_BUCKET,
            postgres_service=postgres_service,
            milvus_service=milvus_service,
            milvus_partition=Config.MILVUS_PARTITION
        )

        # Initialize job manager
        job_manager = JobManager(export_service)

        logger.info("Services initialized successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        logger.info("Shutting down Books DB Service")
        if job_manager is not None:
            job_manager.shutdown()
        job_manager = None
        db_service = None
        export_service = None
        postgres_service = None
        milvus_service = None


# API Tags for documentation
tags_metadata = [
    {"name": "Health", "description": "Health and readiness checks"},
    {"name": "Categories", "description": "Browse and search book categories"},
    {"name": "Authors", "description": "Browse and search authors"},
    {"name": "Books", "description": "Browse and search books"},
    {"name": "Export", "description": "Export books to S3 and PostgreSQL"},
    {"name": "Download", "description": "Download exported books and metadata"},
    {"name": "Delete", "description": "Delete exported books from S3 and PostgreSQL"},
    {"name": "Jobs", "description": "Monitor export jobs and manage the dead letter queue"},
]

# FastAPI app
app = FastAPI(
    title="Books DB API",
    description="API for Shamela library metadata, book exports, and storage management",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=tags_metadata,
)

# CORS Middleware
cors_origins = Config.ALLOWED_ORIGINS.split(",") if Config.ALLOWED_ORIGINS else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
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

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    )


@app.get("/ready", response_model=HealthResponse, tags=["Health"])
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


# ============== Category Endpoints ==============

@app.get("/categories", response_model=CategoryListResponse, tags=["Categories"])
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


@app.get("/categories/search", response_model=CategoryListResponse, tags=["Categories"])
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


@app.get("/categories/{category_id}", response_model=CategoryResponse, tags=["Categories"])
async def get_category(category_id: int):
    """Get a single category by ID."""
    category = db_service.get_category(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryResponse(**category)


# ============== Author Endpoints ==============

@app.get("/authors", response_model=AuthorListResponse, tags=["Authors"])
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


@app.get("/authors/search", response_model=AuthorListResponse, tags=["Authors"])
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


@app.get("/authors/{author_id}", response_model=AuthorWithBooksResponse, tags=["Authors"])
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


# ============== Book Endpoints ==============

@app.get("/books", response_model=BookListResponse, tags=["Books"])
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


@app.get("/books/search", response_model=BookListResponse, tags=["Books"])
async def search_books(
    q: Optional[str] = Query(None, min_length=1),
    category_id: Optional[int] = None,
    author_id: Optional[int] = None,
    hidden: Optional[int] = None,
    printed: Optional[int] = None,
    has_toc: Optional[bool] = None,
    exported: Optional[bool] = None,
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0)
):
    """Search books by name, category, or author with pagination."""
    exported_ids = None
    if exported is not None and postgres_service is not None:
        exported_ids = postgres_service.get_all_exported_book_ids()
    books, total = db_service.search_books(
        q, category_id, author_id, hidden, printed=printed, has_toc=has_toc,
        exported_ids=exported_ids, exported_filter=exported,
        limit=limit, offset=offset,
    )
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


@app.get("/books/by-category/{category_id}", response_model=BookListResponse, tags=["Books"])
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


@app.get("/books/by-author/{author_id}", response_model=BookListResponse, tags=["Books"])
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


@app.get("/books/ids", tags=["Books"])
async def get_filtered_book_ids(
    q: Optional[str] = Query(None, min_length=1),
    category_id: Optional[int] = None,
    author_id: Optional[int] = None,
    hidden: Optional[int] = None,
    printed: Optional[int] = None,
    has_toc: Optional[bool] = None,
    exported: Optional[bool] = None,
):
    """Return all book IDs matching the given filters (no pagination)."""
    exported_ids = None
    if exported is not None and postgres_service is not None:
        exported_ids = postgres_service.get_all_exported_book_ids()
    ids = db_service.search_book_ids(
        q, category_id, author_id, hidden, printed=printed, has_toc=has_toc,
        exported_ids=exported_ids, exported_filter=exported,
    )
    return {"book_ids": ids, "total": len(ids)}


@app.get("/books/{book_id}", response_model=BookResponse, tags=["Books"])
async def get_book(book_id: int):
    """Get a single book by ID."""
    book = db_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return BookResponse(**book)


@app.post("/books/exported", tags=["Books"])
async def check_exported_books(request: ExportRequest):
    """Return which of the given book IDs have been exported to PostgreSQL."""
    if postgres_service is None:
        return {"exported_ids": []}
    exported = postgres_service.get_exported_book_ids(request.book_ids)
    return {"exported_ids": exported}


# ============== Debug Endpoints ==============

@app.get("/raw/{book_id}", tags=["Export"])
async def get_raw_files(book_id: int):
    """Return the raw HTML files for a book as a zip download."""
    import asyncio
    import io
    import zipfile

    book = db_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    def _do():
        files_in_memory = export_service._export_to_memory(book_id)
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for filename, content in sorted(files_in_memory.items()):
                zf.writestr(filename, content)
        buf.seek(0)
        return buf

    zip_buf = await asyncio.get_event_loop().run_in_executor(None, _do)
    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=book_{book_id}_raw.zip"},
    )


@app.post("/chunk/{book_id}", tags=["Export"])
async def chunk_book_endpoint(book_id: int):
    """
    Chunk a book and return the result as a downloadable JSON file.
    Runs: export to memory -> HTML processing -> chunking -> page matching.
    No embedding or uploading.
    """
    import asyncio
    import io

    book = db_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    def _do():
        import json as _json
        from scrape import process_book_html
        from embedding_service import BookChunker, PageMatcher

        files_in_memory = export_service._export_to_memory(book_id)
        html_contents = [
            content.decode("utf-8", errors="ignore")
            for filename, content in sorted(files_in_memory.items())
            if filename.lower().endswith((".htm", ".html"))
        ]

        metadata = process_book_html(
            html_contents=html_contents,
            book_id=book_id,
            book_name=book.get("book_name"),
            author_name=book.get("author_name"),
            category_name=book.get("category_name"),
            table_of_contents=book.get("table_of_contents"),
        )

        chunker = BookChunker()
        chunks, chunking_stats = chunker.chunk_book(metadata)

        matcher = PageMatcher()
        matched_chunks = matcher.match_chunks_to_pages(chunks, metadata)

        result = {
            "book_id": book_id,
            "book_name": book.get("book_name"),
            "parts": metadata.get("parts", []),
            "parts_count": len(metadata.get("parts", [])),
            "total_pages": sum(len(v) for v in metadata.get("pages", {}).values()),
            "total_chunks": len(chunks),
            "chunking_stats": chunking_stats,
            "chunks": [
                {
                    "order": c.get("order"),
                    "text": c.get("text", ""),
                    "start_page_id": c.get("start_page_id"),
                    "page_offset": c.get("page_offset"),
                    "page_num_range": c.get("page_num_range"),
                    "part_title": c.get("part_title"),
                }
                for c in matched_chunks
            ],
        }
        return _json.dumps(result, ensure_ascii=False, indent=2)

    json_str = await asyncio.get_event_loop().run_in_executor(None, _do)
    return StreamingResponse(
        io.BytesIO(json_str.encode("utf-8")),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=book_{book_id}_chunks.json"},
    )


# ============== Export Endpoints ==============

@app.get("/export/list", response_model=BookListResponse, tags=["Export"])
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


@app.post("/export/books", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED, tags=["Export"])
async def export_books(request: ExportRequest):
    """
    Submit a batch export job. Returns immediately with a job ID.

    The job runs in the background using a thread pool:
    - Deletes existing book data from S3, PostgreSQL, and Milvus (if exists)
    - Exports raw HTML files to S3
    - Generates and uploads metadata JSON
    - Upserts embeddings to Milvus

    Poll GET /jobs/{job_id} to track progress.
    """
    books_to_export = []
    for book_id in request.book_ids:
        book = db_service.get_book(book_id)
        if not book:
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")

        books_to_export.append({
            "book_id": book_id,
            "book_name": book.get("book_name"),
            "author_name": book.get("author_name"),
            "category_name": book.get("category_name"),
            "table_of_contents": book.get("table_of_contents"),
            "author_id": book.get("main_author"),
            "category_id": book.get("book_category"),
        })

    job_id = job_manager.submit_job(books_to_export)

    return JobSubmitResponse(
        job_id=job_id,
        message=f"Export job submitted for {len(books_to_export)} book(s)",
    )


@app.post("/export/books/{book_id}", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED, tags=["Export"])
async def export_single_book(book_id: int):
    """
    Submit a single-book export job. Returns immediately with a job ID.

    Poll GET /jobs/{job_id} to track progress.
    """
    book = db_service.get_book(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book_data = {
        "book_id": book_id,
        "book_name": book.get("book_name"),
        "author_name": book.get("author_name"),
        "category_name": book.get("category_name"),
        "table_of_contents": book.get("table_of_contents"),
        "author_id": book.get("main_author"),
        "category_id": book.get("book_category"),
    }

    job_id = job_manager.submit_job([book_data])

    return JobSubmitResponse(
        job_id=job_id,
        message="Export job submitted for 1 book",
    )


# ============== Download Endpoints ==============

@app.get("/download/books/{book_id}", tags=["Download"])
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


@app.post("/download/books", tags=["Download"])
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


@app.get("/download/metadata/{book_id}", tags=["Download"])
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


@app.post("/download/metadata", tags=["Download"])
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


@app.get("/download/embeddings/{book_id}", tags=["Download"])
async def download_single_embeddings(book_id: int):
    """Download embeddings file for a single book."""
    if not db_service.get_book(book_id):
        raise HTTPException(status_code=404, detail="Book not found")

    if not export_service.get_embeddings_url(book_id):
        raise HTTPException(
            status_code=404,
            detail="Embeddings not available. Use /export/books/{book_id} first."
        )

    try:
        zip_buffer, filename = export_service.download_embeddings_as_zip([book_id])
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error("Download embeddings failed", error=str(e), book_id=book_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download/embeddings", tags=["Download"])
async def download_multiple_embeddings(request: ExportRequest):
    """Download embeddings files for multiple books."""
    # Verify all books exist and are exported
    missing_embeddings = []
    for book_id in request.book_ids:
        if not db_service.get_book(book_id):
            raise HTTPException(status_code=404, detail=f"Book {book_id} not found")
        if not export_service.get_embeddings_url(book_id):
            missing_embeddings.append(book_id)

    if missing_embeddings:
        raise HTTPException(
            status_code=404,
            detail=f"Embeddings not available for books: {missing_embeddings}. Use /export/books first."
        )

    try:
        zip_buffer, filename = export_service.download_embeddings_as_zip(request.book_ids)
        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error("Download embeddings failed", error=str(e), book_ids=request.book_ids)
        raise HTTPException(status_code=500, detail=str(e))


# ============== Job Endpoints ==============

@app.get("/jobs", response_model=JobListResponse, tags=["Jobs"])
async def list_jobs(
    status_filter: Optional[JobStatus] = Query(None, alias="status", description="Filter by job status"),
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0),
):
    """List all export jobs with optional status filter and pagination."""
    jobs, total = job_manager.list_jobs(status_filter=status_filter, limit=limit, offset=offset)
    return JobListResponse(jobs=jobs, total=total)


@app.get("/jobs/dlq", response_model=DeadLetterListResponse, tags=["Jobs"])
async def list_dlq(
    limit: Optional[int] = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    offset: Optional[int] = Query(0, ge=0),
):
    """List dead letter queue entries (failed book exports)."""
    entries, total = job_manager.get_dlq(limit=limit, offset=offset)
    return DeadLetterListResponse(entries=entries, total=total)


@app.get("/jobs/{job_id}", response_model=JobResponse, tags=["Jobs"])
async def get_job(job_id: str):
    """Get detailed status of a specific export job, including per-book progress."""
    job = job_manager.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/jobs/dlq/{index}/retry", response_model=JobSubmitResponse, status_code=status.HTTP_202_ACCEPTED, tags=["Jobs"])
async def retry_dlq_entry(index: int):
    """Retry a failed export from the dead letter queue. Creates a new job."""
    new_job_id = job_manager.retry_dlq_entry(index)
    if new_job_id is None:
        raise HTTPException(status_code=404, detail="DLQ entry not found")
    return JobSubmitResponse(job_id=new_job_id, message="Retry job submitted")


@app.delete("/jobs/dlq", tags=["Jobs"])
async def clear_dlq():
    """Clear all entries from the dead letter queue."""
    job_manager.clear_dlq()
    return {"message": "Dead letter queue cleared"}


# ============== Delete Endpoints ==============

@app.delete("/books/{book_id}", response_model=DeleteResponse, tags=["Delete"])
async def delete_book(book_id: int):
    """
    Delete a book from S3 and PostgreSQL.

    This will:
    - Delete raw HTML files from S3
    - Delete metadata JSON from S3
    - Delete embeddings JSONL from S3
    - Delete the book record from PostgreSQL
    - Delete associated pages from PostgreSQL
    - Delete stats from PostgreSQL
    - Clean up orphaned authors and categories
    """
    # Verify book exists in the source database
    if not db_service.get_book(book_id):
        raise HTTPException(status_code=404, detail="Book not found in source database")

    try:
        deleted = export_service.delete_book(book_id)

        if deleted:
            return DeleteResponse(
                book_id=book_id,
                deleted=True,
                message="Book deleted successfully from S3 and PostgreSQL",
                timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            )
        else:
            return DeleteResponse(
                book_id=book_id,
                deleted=False,
                message="Book was not found in S3 or PostgreSQL (may not have been exported)",
                timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
            )
    except Exception as e:
        logger.error("Delete failed", error=str(e), book_id=book_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/books", response_model=DeleteBatchResponse, tags=["Delete"])
async def delete_books(request: ExportRequest):
    """
    Delete multiple books from S3 and PostgreSQL.

    This will for each book:
    - Delete raw HTML files from S3
    - Delete metadata JSON from S3
    - Delete embeddings JSONL from S3
    - Delete the book record from PostgreSQL
    - Delete associated pages from PostgreSQL
    - Delete stats from PostgreSQL
    - Clean up orphaned authors and categories
    """
    deleted_count = 0
    errors = []

    for book_id in request.book_ids:
        try:
            if export_service.delete_book(book_id):
                deleted_count += 1
        except Exception as e:
            errors.append(f"Book {book_id}: {str(e)}")
            logger.error("Failed to delete book", book_id=book_id, error=str(e))

    if errors:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete some books: {'; '.join(errors)}"
        )

    return DeleteBatchResponse(
        book_ids=request.book_ids,
        deleted_count=deleted_count,
        message=f"Deleted {deleted_count} book(s) successfully",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
    )


# ============== Static UI Serving ==============

UI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ui", "dist")

if os.path.isdir(UI_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(UI_DIR, "assets")), name="ui-assets")

    @app.get("/{full_path:path}", tags=["UI"])
    async def serve_ui(full_path: str):
        """Serve the React SPA for any non-API route."""
        file_path = os.path.join(UI_DIR, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(UI_DIR, "index.html"))


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
