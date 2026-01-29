"""Job manager for async export processing with thread pool and dead letter queue."""

import os
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Any, Dict, List, Optional, TYPE_CHECKING

import structlog

from models import (
    JobStatus, BookJobStatus, BookJobResult,
    JobResponse, DeadLetterEntry,
)

if TYPE_CHECKING:
    from utils import ExportService

logger = structlog.get_logger()

EXPORT_WORKERS = int(os.getenv("EXPORT_WORKERS", "3"))


def _now_utc() -> str:
    return time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())


class _JobState:
    """Internal mutable state for a single job."""

    def __init__(self, job_id: str, books_data: List[Dict[str, Any]], use_deepinfra: bool):
        self.job_id = job_id
        self.status = JobStatus.PENDING
        self.use_deepinfra = use_deepinfra
        self.created_at = _now_utc()
        self.updated_at = self.created_at
        self.books: Dict[int, BookJobResult] = {
            b["book_id"]: BookJobResult(book_id=b["book_id"], status=BookJobStatus.PENDING)
            for b in books_data
        }
        self.books_data: Dict[int, Dict[str, Any]] = {b["book_id"]: b for b in books_data}
        # Track start timestamps as floats for elapsed_seconds computation
        self._started_at_ts: Dict[int, float] = {}

    def to_response(self) -> JobResponse:
        book_list = []
        now = time.time()
        for book_id, b in self.books.items():
            # Compute elapsed_seconds dynamically for in-progress books
            if b.status == BookJobStatus.IN_PROGRESS and book_id in self._started_at_ts:
                b.elapsed_seconds = round(now - self._started_at_ts[book_id], 1)
            book_list.append(b)
        completed = sum(1 for b in book_list if b.status == BookJobStatus.COMPLETED)
        failed = sum(1 for b in book_list if b.status == BookJobStatus.FAILED)
        total = len(book_list)
        done = completed + failed
        progress = done / total if total > 0 else 0.0
        return JobResponse(
            job_id=self.job_id,
            status=self.status,
            total_books=total,
            completed_books=completed,
            failed_books=failed,
            progress=round(progress, 4),
            books=book_list,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class JobManager:
    """Manages async export jobs with a thread pool and dead letter queue."""

    def __init__(self, export_service: "ExportService"):
        self.export_service = export_service
        self._executor = ThreadPoolExecutor(max_workers=EXPORT_WORKERS)
        self._lock = threading.Lock()
        self._jobs: Dict[str, _JobState] = {}
        self._dlq: List[DeadLetterEntry] = []
        logger.info("JobManager initialized", workers=EXPORT_WORKERS)

    def shutdown(self):
        self._executor.shutdown(wait=False)
        logger.info("JobManager shut down")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def submit_job(self, books_data: List[Dict[str, Any]], use_deepinfra: bool = False) -> str:
        job_id = str(uuid.uuid4())
        state = _JobState(job_id, books_data, use_deepinfra)
        with self._lock:
            self._jobs[job_id] = state
        self._executor.submit(self._run_job, job_id)
        logger.info("Job submitted", job_id=job_id, book_count=len(books_data))
        return job_id

    def get_job(self, job_id: str) -> Optional[JobResponse]:
        with self._lock:
            state = self._jobs.get(job_id)
            if state is None:
                return None
            return state.to_response()

    def list_jobs(
        self,
        status_filter: Optional[JobStatus] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[JobResponse], int]:
        with self._lock:
            all_states = list(self._jobs.values())

        if status_filter is not None:
            all_states = [s for s in all_states if s.status == status_filter]

        # Sort newest first
        all_states.sort(key=lambda s: s.created_at, reverse=True)
        total = len(all_states)
        page = all_states[offset : offset + limit]
        return [s.to_response() for s in page], total

    def get_dlq(self, limit: int = 50, offset: int = 0) -> tuple[List[DeadLetterEntry], int]:
        with self._lock:
            total = len(self._dlq)
            page = self._dlq[offset : offset + limit]
            return list(page), total

    def retry_dlq_entry(self, index: int) -> Optional[str]:
        """Re-submit a DLQ entry as a new single-book job. Returns the new job_id or None."""
        with self._lock:
            if index < 0 or index >= len(self._dlq):
                return None
            entry = self._dlq.pop(index)

        # We need book_data to resubmit – reconstruct minimal dict
        book_data = {"book_id": entry.book_id}

        # Try to get richer data from the original job
        with self._lock:
            original = self._jobs.get(entry.job_id)
            if original and entry.book_id in original.books_data:
                book_data = original.books_data[entry.book_id]

        return self.submit_job([book_data], use_deepinfra=False)

    def clear_dlq(self):
        with self._lock:
            self._dlq.clear()

    # ------------------------------------------------------------------
    # Internal processing
    # ------------------------------------------------------------------

    def _run_job(self, job_id: str):
        with self._lock:
            state = self._jobs[job_id]
            state.status = JobStatus.IN_PROGRESS
            state.updated_at = _now_utc()

        book_ids = list(state.books.keys())
        futures: Dict[int, Future] = {}

        for book_id in book_ids:
            future = self._executor.submit(
                self._export_single_book, job_id, book_id
            )
            futures[book_id] = future

        # Wait for all books in this job
        for book_id, future in futures.items():
            future.result()  # blocks until done; exceptions already handled inside

        # Determine final job status
        with self._lock:
            books = list(state.books.values())
            completed = sum(1 for b in books if b.status == BookJobStatus.COMPLETED)
            failed = sum(1 for b in books if b.status == BookJobStatus.FAILED)
            total = len(books)

            if completed == total:
                state.status = JobStatus.COMPLETED
            elif failed == total:
                state.status = JobStatus.FAILED
            else:
                state.status = JobStatus.COMPLETED_WITH_ERRORS
            state.updated_at = _now_utc()

        logger.info(
            "Job finished",
            job_id=job_id,
            status=state.status.value,
            completed=completed,
            failed=failed,
        )

    def _export_single_book(self, job_id: str, book_id: int):
        with self._lock:
            state = self._jobs[job_id]
            book_result = state.books[book_id]
            book_data = state.books_data[book_id]
            use_deepinfra = state.use_deepinfra
            book_result.status = BookJobStatus.IN_PROGRESS
            book_result.started_at = _now_utc()
            book_result.current_step = "exporting"
            state._started_at_ts[book_id] = time.time()
            state.updated_at = _now_utc()

        def _progress_callback(event: str, value):
            with self._lock:
                if event == "step":
                    book_result.current_step = value
                elif event == "chunking_done":
                    book_result.total_chunks = value
                    book_result.chunks_embedded = 0
                elif event == "embedding_progress":
                    book_result.chunks_embedded = value
                state.updated_at = _now_utc()

        try:
            # Delete existing book data before re-exporting
            if self.export_service.book_exists_in_s3(book_id):
                logger.info("Deleting existing book before re-export", book_id=book_id, job_id=job_id)
                self.export_service.delete_book(book_id)

            raw_files_count, metadata_url = self.export_service.export_book_with_metadata(
                book_id=book_id,
                book_name=book_data.get("book_name"),
                author_name=book_data.get("author_name"),
                category_name=book_data.get("category_name"),
                table_of_contents=book_data.get("table_of_contents"),
                author_id=book_data.get("author_id"),
                category_id=book_data.get("category_id"),
                use_deepinfra=use_deepinfra,
                progress_callback=_progress_callback,
            )

            with self._lock:
                book_result.status = BookJobStatus.COMPLETED
                book_result.raw_files_count = raw_files_count
                book_result.metadata_url = metadata_url
                book_result.completed_at = _now_utc()
                book_result.current_step = None
                elapsed = time.time() - state._started_at_ts.get(book_id, time.time())
                book_result.elapsed_seconds = round(elapsed, 1)
                state.updated_at = _now_utc()

            logger.info("Book exported successfully", book_id=book_id, job_id=job_id)

        except Exception as exc:
            error_msg = str(exc)
            logger.error("Book export failed", book_id=book_id, job_id=job_id, error=error_msg)

            with self._lock:
                book_result.status = BookJobStatus.FAILED
                book_result.error = error_msg
                book_result.completed_at = _now_utc()
                book_result.current_step = None
                elapsed = time.time() - state._started_at_ts.get(book_id, time.time())
                book_result.elapsed_seconds = round(elapsed, 1)
                state.updated_at = _now_utc()

                self._dlq.append(DeadLetterEntry(
                    job_id=job_id,
                    book_id=book_id,
                    error=error_msg,
                    failed_at=_now_utc(),
                ))
