"""Pydantic models for Books DB API (Read-Only)."""

from typing import Any, List, Optional
from pydantic import BaseModel, Field
from enum import Enum


# ============== Pagination Models ==============

class PaginationMeta(BaseModel):
    total: int
    limit: int
    offset: int
    has_more: bool


# ============== Base Response Models ==============

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str


# ============== Category Models ==============

class CategoryResponse(BaseModel):
    category_id: int
    category_name: Optional[str] = None
    category_order: Optional[Any] = None

    class Config:
        from_attributes = True


class CategoryListResponse(BaseModel):
    categories: List[CategoryResponse]
    count: int
    pagination: Optional[PaginationMeta] = None


# ============== Author Models ==============

class AuthorResponse(BaseModel):
    author_id: int
    author_name: Optional[str] = None
    death_number: Optional[int] = None
    death_text: Optional[str] = None
    alpha: Optional[int] = None

    class Config:
        from_attributes = True


class BookSummaryResponse(BaseModel):
    book_id: int
    book_name: Optional[str] = None
    book_category: Optional[int] = None

    class Config:
        from_attributes = True


class AuthorWithBooksResponse(AuthorResponse):
    books: List[BookSummaryResponse] = []


class AuthorListResponse(BaseModel):
    authors: List[AuthorResponse]
    count: int
    pagination: Optional[PaginationMeta] = None


# ============== Book Models ==============

class BookResponse(BaseModel):
    book_id: int
    book_name: Optional[str] = None
    book_category: Optional[int] = None
    book_type: Optional[int] = None
    book_date: Optional[int] = None
    authors: Optional[str] = None
    main_author: Optional[int] = None
    printed: Optional[int] = None
    group_id: Optional[int] = None
    hidden: Optional[int] = None
    major_online: Optional[int] = None
    minor_online: Optional[int] = None
    major_ondisk: Optional[int] = None
    minor_ondisk: Optional[int] = None
    pdf_links: Optional[str] = None
    pdf_ondisk: Optional[int] = None
    pdf_online: Optional[int] = None
    cover_ondisk: Optional[int] = None
    cover_online: Optional[int] = None
    meta_data: Optional[str] = None
    parent: Optional[int] = None
    alpha: Optional[int] = None
    group_order: Optional[int] = None
    book_up: Optional[int] = None
    category_name: Optional[str] = None
    author_name: Optional[str] = None

    class Config:
        from_attributes = True


class BookListResponse(BaseModel):
    books: List[BookResponse]
    count: int
    pagination: Optional[PaginationMeta] = None


# ============== Export Models ==============

class ExportRequest(BaseModel):
    book_ids: List[int] = Field(..., min_length=1, max_length=100)
    use_deepinfra: bool = Field(default=False, description="Use DeepInfra API for embeddings instead of local model")


class ExportResponse(BaseModel):
    book_ids: List[int]
    uploaded_files: List[str]
    message: str
    timestamp: str


# ============== Export Result Models ==============

class ExportedBookResult(BaseModel):
    """Result for a single exported book with raw files and metadata."""
    book_id: int
    raw_files_count: int
    metadata_url: Optional[str] = None


class ExportWithMetadataResponse(BaseModel):
    """Response for export endpoint that includes both raw files and metadata."""
    book_ids: List[int]
    results: List[ExportedBookResult]
    message: str
    timestamp: str


# ============== Job Models ==============

class JobStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    COMPLETED_WITH_ERRORS = "completed_with_errors"
    FAILED = "failed"


class BookJobStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class BookJobResult(BaseModel):
    book_id: int
    status: BookJobStatus
    raw_files_count: Optional[int] = None
    metadata_url: Optional[str] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    total_books: int
    completed_books: int
    failed_books: int
    progress: float
    books: List[BookJobResult]
    created_at: str
    updated_at: str


class JobSubmitResponse(BaseModel):
    job_id: str
    message: str


class DeadLetterEntry(BaseModel):
    job_id: str
    book_id: int
    error: str
    failed_at: str


class DeadLetterListResponse(BaseModel):
    entries: List[DeadLetterEntry]
    total: int


class JobListResponse(BaseModel):
    jobs: List[JobResponse]
    total: int


# ============== Delete Models ==============

class DeleteResponse(BaseModel):
    """Response for delete endpoint."""
    book_id: int
    deleted: bool
    message: str
    timestamp: str


class DeleteBatchResponse(BaseModel):
    """Response for batch delete endpoint."""
    book_ids: List[int]
    deleted_count: int
    message: str
    timestamp: str
