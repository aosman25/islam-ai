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


class ExportResponse(BaseModel):
    book_ids: List[int]
    uploaded_files: List[str]
    message: str
    timestamp: str
