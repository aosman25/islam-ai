"""Database and export service utilities for Books DB API (Read-Only)."""

import io
import sqlite3
import subprocess
import shutil
import zipfile
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from contextlib import contextmanager
import structlog
import boto3
from botocore.config import Config as BotoConfig

logger = structlog.get_logger()


class DatabaseService:
    """SQLite database service for read-only metadata operations."""

    def __init__(self, db_path: str):
        self.db_path = db_path

    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _row_to_dict(self, row: sqlite3.Row) -> Optional[Dict[str, Any]]:
        """Convert SQLite Row to dictionary."""
        return dict(row) if row else None

    def _apply_pagination(self, sql: str, limit: Optional[int], offset: Optional[int]) -> str:
        """Apply LIMIT and OFFSET to SQL query."""
        if limit is not None:
            sql += f" LIMIT {limit}"
            if offset is not None:
                sql += f" OFFSET {offset}"
        return sql

    # ============== Category Operations ==============

    def get_all_categories(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute("SELECT COUNT(*) FROM category")
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = "SELECT * FROM category ORDER BY category_order"
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql)
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    def get_category(self, category_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM category WHERE category_id = ?",
                (category_id,)
            )
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def search_categories(
        self,
        query: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute(
                "SELECT COUNT(*) FROM category WHERE category_name LIKE ?",
                (f"%{query}%",)
            )
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = "SELECT * FROM category WHERE category_name LIKE ? ORDER BY category_order"
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql, (f"%{query}%",))
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    # ============== Author Operations ==============

    def get_all_authors(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute("SELECT COUNT(*) FROM author")
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = "SELECT * FROM author ORDER BY author_name"
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql)
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    def get_author(self, author_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.execute(
                "SELECT * FROM author WHERE author_id = ?",
                (author_id,)
            )
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def get_author_books(self, author_id: int) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """SELECT b.book_id, b.book_name, b.book_category
                   FROM book b
                   JOIN author_book ab ON b.book_id = ab.book_id
                   WHERE ab.author_id = ?
                   UNION
                   SELECT b.book_id, b.book_name, b.book_category
                   FROM book b
                   WHERE b.main_author = ?
                   ORDER BY book_name""",
                (author_id, author_id)
            )
            return [self._row_to_dict(row) for row in cursor.fetchall()]

    def search_authors(
        self,
        query: str,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute(
                "SELECT COUNT(*) FROM author WHERE author_name LIKE ?",
                (f"%{query}%",)
            )
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = "SELECT * FROM author WHERE author_name LIKE ? ORDER BY author_name"
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql, (f"%{query}%",))
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    # ============== Book Operations ==============

    def get_all_books(
        self,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute("SELECT COUNT(*) FROM book")
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = """SELECT b.*, c.category_name, a.author_name
                     FROM book b
                     LEFT JOIN category c ON b.book_category = c.category_id
                     LEFT JOIN author a ON b.main_author = a.author_id
                     ORDER BY b.book_name"""
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql)
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    def get_book(self, book_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cursor = conn.execute(
                """SELECT b.*, c.category_name, a.author_name
                   FROM book b
                   LEFT JOIN category c ON b.book_category = c.category_id
                   LEFT JOIN author a ON b.main_author = a.author_id
                   WHERE b.book_id = ?""",
                (book_id,)
            )
            row = cursor.fetchone()
            return self._row_to_dict(row)

    def get_books_by_category(
        self,
        category_id: int,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute(
                "SELECT COUNT(*) FROM book WHERE book_category = ?",
                (category_id,)
            )
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = """SELECT b.*, c.category_name, a.author_name
                     FROM book b
                     LEFT JOIN category c ON b.book_category = c.category_id
                     LEFT JOIN author a ON b.main_author = a.author_id
                     WHERE b.book_category = ?
                     ORDER BY b.book_name"""
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql, (category_id,))
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    def get_books_by_author(
        self,
        author_id: int,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        with self.get_connection() as conn:
            # Get total count
            count_cursor = conn.execute(
                """SELECT COUNT(*) FROM book
                   WHERE main_author = ?
                   OR book_id IN (SELECT book_id FROM author_book WHERE author_id = ?)""",
                (author_id, author_id)
            )
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = """SELECT b.*, c.category_name, a.author_name
                     FROM book b
                     LEFT JOIN category c ON b.book_category = c.category_id
                     LEFT JOIN author a ON b.main_author = a.author_id
                     WHERE b.main_author = ?
                     OR b.book_id IN (SELECT book_id FROM author_book WHERE author_id = ?)
                     ORDER BY b.book_name"""
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql, (author_id, author_id))
            return [self._row_to_dict(row) for row in cursor.fetchall()], total

    def search_books(
        self,
        query: Optional[str] = None,
        category_id: Optional[int] = None,
        author_id: Optional[int] = None,
        hidden: Optional[int] = None,
        limit: Optional[int] = None,
        offset: Optional[int] = None
    ) -> Tuple[List[Dict[str, Any]], int]:
        # Build WHERE clause
        where_clause = "WHERE 1=1"
        params = []

        if query:
            where_clause += " AND b.book_name LIKE ?"
            params.append(f"%{query}%")

        if category_id is not None:
            where_clause += " AND b.book_category = ?"
            params.append(category_id)

        if author_id is not None:
            where_clause += " AND (b.main_author = ? OR b.book_id IN (SELECT book_id FROM author_book WHERE author_id = ?))"
            params.extend([author_id, author_id])

        if hidden is not None:
            where_clause += " AND b.hidden = ?"
            params.append(hidden)

        with self.get_connection() as conn:
            # Get total count
            count_sql = f"SELECT COUNT(*) FROM book b {where_clause}"
            count_cursor = conn.execute(count_sql, params)
            total = count_cursor.fetchone()[0]

            # Get paginated data
            sql = f"""SELECT b.*, c.category_name, a.author_name
                      FROM book b
                      LEFT JOIN category c ON b.book_category = c.category_id
                      LEFT JOIN author a ON b.main_author = a.author_id
                      {where_clause}
                      ORDER BY b.book_name"""
            sql = self._apply_pagination(sql, limit, offset)
            cursor = conn.execute(sql, params)
            return [self._row_to_dict(row) for row in cursor.fetchall()], total


class ExportService:
    """Service for exporting books and uploading to Backblaze B2."""

    def __init__(
        self,
        base_dir: str,
        s3_endpoint: Optional[str] = None,
        s3_access_key: Optional[str] = None,
        s3_secret_key: Optional[str] = None,
        s3_bucket: str = "islamic-library"
    ):
        self.base_dir = Path(base_dir)
        self.export_script = self.base_dir / "export_books.sh"
        self.export_dir = self.base_dir / "export"

        # S3/B2 configuration
        self.s3_bucket = s3_bucket
        self.s3_endpoint = s3_endpoint
        self.s3_client = None

        if s3_endpoint and s3_access_key and s3_secret_key:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=s3_endpoint,
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key,
                config=BotoConfig(signature_version='s3v4')
            )
            logger.info("S3 client initialized", endpoint=s3_endpoint, bucket=s3_bucket)

    def get_book_files_from_s3(self, book_id: int) -> Optional[List[str]]:
        """Check if a book exists in S3 and return list of file URLs."""
        if not self.s3_client:
            return None

        s3_prefix = f"raw/{book_id}/"

        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=s3_prefix
            )

            if "Contents" not in response or len(response["Contents"]) == 0:
                return None

            # Build URLs for each file
            # For Backblaze B2, the public URL format is:
            # https://{bucket}.{endpoint_host}/{key}
            # Or use the S3 endpoint directly
            files = []
            for obj in response["Contents"]:
                key = obj["Key"]
                # Build URL using the endpoint
                if self.s3_endpoint:
                    # Parse endpoint to build public URL
                    # e.g., https://s3.us-west-004.backblazeb2.com -> https://islamic-library.s3.us-west-004.backblazeb2.com/raw/123/001.htm
                    endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
                    url = f"https://{self.s3_bucket}.{endpoint_host}/{key}"
                else:
                    url = key
                files.append(url)

            logger.info("Found existing book in S3", book_id=book_id, file_count=len(files))
            return files

        except Exception as e:
            logger.error("Failed to check S3 for book", book_id=book_id, error=str(e))
            return None

    def book_exists_in_s3(self, book_id: int) -> bool:
        """Check if a book already exists in S3."""
        files = self.get_book_files_from_s3(book_id)
        return files is not None and len(files) > 0

    def download_books_as_zip(self, book_ids: List[int]) -> Tuple[io.BytesIO, str]:
        """Download book files from S3 and return as a zip file in memory.

        Returns:
            Tuple of (BytesIO containing zip data, suggested filename)
        """
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for book_id in book_ids:
                s3_prefix = f"raw/{book_id}/"

                try:
                    response = self.s3_client.list_objects_v2(
                        Bucket=self.s3_bucket,
                        Prefix=s3_prefix
                    )

                    if "Contents" not in response or len(response["Contents"]) == 0:
                        logger.warning("No files found for book", book_id=book_id)
                        continue

                    for obj in response["Contents"]:
                        key = obj["Key"]
                        filename = key.split("/")[-1]  # Get just the filename

                        # Download file content
                        file_obj = self.s3_client.get_object(
                            Bucket=self.s3_bucket,
                            Key=key
                        )
                        file_content = file_obj["Body"].read()

                        # Add to zip with path: book_id/filename
                        zip_path = f"{book_id}/{filename}"
                        zip_file.writestr(zip_path, file_content)
                        logger.debug("Added file to zip", file=zip_path)

                except Exception as e:
                    logger.error("Failed to download book from S3", book_id=book_id, error=str(e))
                    raise

        zip_buffer.seek(0)

        # Generate filename
        if len(book_ids) == 1:
            filename = f"book_{book_ids[0]}.zip"
        else:
            filename = f"books_{'-'.join(map(str, book_ids[:5]))}.zip"

        logger.info("Created zip file", book_count=len(book_ids), size=zip_buffer.getbuffer().nbytes)
        return zip_buffer, filename

    def _clear_export_directory(self) -> None:
        """Clear the export directory before a new export."""
        if self.export_dir.exists():
            for item in self.export_dir.iterdir():
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
            logger.info("Cleared export directory", path=str(self.export_dir))

    def _find_export_directory(self) -> Optional[Path]:
        """Find the export directory created after running export script."""
        if not self.export_dir.exists():
            return None

        # Find the single directory that should have been created
        for item in self.export_dir.iterdir():
            if item.is_dir():
                return item
        return None

    def _cleanup_local_export(self, export_path: Path) -> None:
        """Remove local export files after successful upload."""
        try:
            if export_path.exists():
                shutil.rmtree(export_path)
                logger.info("Cleaned up local export directory", path=str(export_path))
        except Exception as e:
            logger.warning("Failed to cleanup local export", path=str(export_path), error=str(e))

    def _upload_to_s3_and_cleanup(self, book_id: int, local_dir: Path) -> List[str]:
        """Upload exported book files to S3/B2 and cleanup local files."""
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        uploaded_files = []
        s3_prefix = f"raw/{book_id}"

        try:
            for file_path in local_dir.iterdir():
                if file_path.is_file():
                    s3_key = f"{s3_prefix}/{file_path.name}"
                    content_type = "text/html" if file_path.suffix.lower() in [".htm", ".html"] else "application/octet-stream"

                    self.s3_client.upload_file(
                        str(file_path),
                        self.s3_bucket,
                        s3_key,
                        ExtraArgs={"ContentType": content_type}
                    )

                    # Build public URL
                    endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
                    url = f"https://{self.s3_bucket}.{endpoint_host}/{s3_key}"
                    uploaded_files.append(url)
                    logger.info("Uploaded file to S3", file=s3_key, bucket=self.s3_bucket)

            # Cleanup local files after successful upload
            self._cleanup_local_export(local_dir)

        except Exception as e:
            logger.error("Failed to upload to S3", error=str(e), book_id=book_id)
            raise

        return uploaded_files

    def export_books(self, book_ids: List[int]) -> Tuple[List[str], str]:
        """Export books and upload to S3. Returns (uploaded_files, message)."""
        if not self.s3_client:
            raise ValueError("S3 client not configured - cannot export without storage")

        all_uploaded_files = []

        for book_id in book_ids:
            logger.info("Exporting book", book_id=book_id)

            # Clear export directory before each book to ensure we find the right one
            self._clear_export_directory()

            # Run export script
            result = subprocess.run(
                ["bash", str(self.export_script), str(book_id)],
                cwd=str(self.base_dir),
                capture_output=True,
                text=True,
                timeout=3600
            )

            if result.returncode != 0:
                error_msg = result.stderr or result.stdout or "Unknown error"
                raise RuntimeError(f"Export failed for book {book_id}: {error_msg}")

            # Find and upload exported files
            export_path = self._find_export_directory()
            if not export_path:
                raise RuntimeError(f"Export directory not found for book {book_id}")

            uploaded = self._upload_to_s3_and_cleanup(book_id, export_path)
            all_uploaded_files.extend(uploaded)

        return all_uploaded_files, f"Successfully exported {len(book_ids)} book(s)"
