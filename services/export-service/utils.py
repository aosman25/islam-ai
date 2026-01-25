"""Database and export service utilities for Books DB API (Read-Only)."""

import asyncio
import io
import sqlite3
import subprocess
import shutil
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Iterator, TYPE_CHECKING
from contextlib import contextmanager
import structlog
import boto3
from botocore.config import Config as BotoConfig

if TYPE_CHECKING:
    from postgres_service import PostgresService

logger = structlog.get_logger()

# Thread pool for async S3 operations
_executor = ThreadPoolExecutor(max_workers=10)


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
        s3_bucket: str = "islamic-library",
        postgres_service: Optional["PostgresService"] = None
    ):
        self.base_dir = Path(base_dir)
        self.export_script = self.base_dir / "export_books.sh"
        self.export_dir = self.base_dir / "export"

        # S3/B2 configuration
        self.s3_bucket = s3_bucket
        self.s3_endpoint = s3_endpoint
        self.s3_client = None
        self.postgres_service = postgres_service

        if s3_endpoint and s3_access_key and s3_secret_key:
            self.s3_client = boto3.client(
                's3',
                endpoint_url=s3_endpoint,
                aws_access_key_id=s3_access_key,
                aws_secret_access_key=s3_secret_key,
                config=BotoConfig(signature_version='s3v4')
            )
            logger.info("S3 client initialized", endpoint=s3_endpoint, bucket=s3_bucket)

        if postgres_service:
            logger.info("PostgreSQL export enabled")

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

    def delete_book_from_s3(self, book_id: int) -> bool:
        """
        Delete a book's raw files and metadata from S3.

        Returns:
            True if files were deleted, False if nothing was found
        """
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        deleted_count = 0

        # Delete raw files
        raw_prefix = f"raw/{book_id}/"
        try:
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=raw_prefix
            )
            if "Contents" in response:
                for obj in response["Contents"]:
                    self.s3_client.delete_object(Bucket=self.s3_bucket, Key=obj["Key"])
                    deleted_count += 1
        except Exception as e:
            logger.error("Failed to delete raw files from S3", book_id=book_id, error=str(e))
            raise

        # Delete metadata file
        metadata_key = f"metadata/{book_id}.json"
        try:
            self.s3_client.delete_object(Bucket=self.s3_bucket, Key=metadata_key)
            deleted_count += 1
        except Exception as e:
            # Ignore if metadata doesn't exist
            logger.debug("Metadata file not found or already deleted", book_id=book_id)

        # Delete text file if exists
        text_key = f"text/{book_id}.md"
        try:
            self.s3_client.delete_object(Bucket=self.s3_bucket, Key=text_key)
            deleted_count += 1
        except Exception:
            pass

        logger.info("Deleted book from S3", book_id=book_id, deleted_files=deleted_count)
        return deleted_count > 0

    def delete_book(self, book_id: int) -> bool:
        """
        Delete a book from both S3 and PostgreSQL.

        Returns:
            True if book was deleted from at least one store
        """
        s3_deleted = False
        pg_deleted = False

        # Delete from S3
        try:
            s3_deleted = self.delete_book_from_s3(book_id)
        except Exception as e:
            logger.error("Failed to delete from S3", book_id=book_id, error=str(e))
            raise

        # Delete from PostgreSQL
        if self.postgres_service:
            try:
                pg_deleted = self.postgres_service.delete_book(book_id)
            except Exception as e:
                logger.error("Failed to delete from PostgreSQL", book_id=book_id, error=str(e))
                raise

        return s3_deleted or pg_deleted

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

    def _read_export_to_memory(self, local_dir: Path) -> Dict[str, bytes]:
        """Read exported book files from local directory into memory.

        Returns:
            Dict mapping filename to file content bytes
        """
        files = {}
        for file_path in sorted(local_dir.iterdir()):
            if file_path.is_file():
                files[file_path.name] = file_path.read_bytes()
        return files

    def _upload_raw_files_from_memory(self, book_id: int, files: Dict[str, bytes]) -> List[str]:
        """Upload raw book files from memory to S3/B2.

        Args:
            book_id: The book ID
            files: Dict mapping filename to file content bytes

        Returns:
            List of uploaded file URLs
        """
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        uploaded_files = []
        s3_prefix = f"raw/{book_id}"

        for filename, content in files.items():
            s3_key = f"{s3_prefix}/{filename}"
            content_type = "text/html" if filename.lower().endswith((".htm", ".html")) else "application/octet-stream"

            self.s3_client.put_object(
                Bucket=self.s3_bucket,
                Key=s3_key,
                Body=content,
                ContentType=content_type
            )

            # Build public URL
            endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
            url = f"https://{self.s3_bucket}.{endpoint_host}/{s3_key}"
            uploaded_files.append(url)

        logger.info("Uploaded raw files to S3", book_id=book_id, file_count=len(uploaded_files))
        return uploaded_files

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

    def _export_to_memory(self, book_id: int) -> Dict[str, bytes]:
        """Export raw HTML files for a book directly to memory using stdout mode.

        This uses the Java exporter's --stdout mode to output JSON directly,
        completely bypassing disk I/O for maximum efficiency.

        Returns:
            Dict mapping filename to file content bytes
        """
        import json

        logger.info("Exporting raw files for book directly to memory", book_id=book_id)

        # Run export script with --stdout mode to get JSON output directly
        result = subprocess.run(
            ["bash", str(self.export_script), "--stdout", str(book_id)],
            cwd=str(self.base_dir),
            capture_output=True,
            text=True,
            timeout=3600
        )

        if result.returncode != 0:
            error_msg = result.stderr or "Unknown error"
            raise RuntimeError(f"Export failed for book {book_id}: {error_msg}")

        # Parse JSON output from stdout
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Failed to parse export output for book {book_id}: {e}")

        # Convert string content to bytes
        files = {
            filename: content.encode("utf-8")
            for filename, content in data.get("files", {}).items()
        }

        logger.info("Exported book directly to memory", book_id=book_id, file_count=len(files))
        return files

    def _export_raw_files(self, book_id: int) -> int:
        """Export raw HTML files for a book and upload to S3. Returns count of uploaded files.

        DEPRECATED: Use _export_to_memory + _upload_raw_files_from_memory for the optimized flow.
        """
        if not self.s3_client:
            raise ValueError("S3 client not configured - cannot export without storage")

        logger.info("Exporting raw files for book", book_id=book_id)

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
        return len(uploaded)

    def _upload_metadata(self, book_id: int, metadata: Dict[str, Any]) -> str:
        """Upload metadata JSON to S3 and return URL."""
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        import json

        metadata_key = f"metadata/{book_id}.json"
        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=metadata_key,
            Body=json.dumps(metadata, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json; charset=utf-8"
        )

        endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
        metadata_url = f"https://{self.s3_bucket}.{endpoint_host}/{metadata_key}"

        logger.info("Uploaded metadata", book_id=book_id, metadata_key=metadata_key)
        return metadata_url

    def _export_to_postgres(
        self,
        metadata: Dict[str, Any],
        author_id: Optional[int] = None,
        category_id: Optional[int] = None
    ) -> None:
        """Export metadata to PostgreSQL."""
        if not self.postgres_service:
            raise ValueError("PostgreSQL service not configured")

        self.postgres_service.export_book_metadata(
            metadata,
            author_id=author_id,
            category_id=category_id
        )

    def export_book_with_metadata(
        self,
        book_id: int,
        book_name: str,
        author_name: Optional[str],
        category_name: Optional[str],
        table_of_contents: Optional[str] = None,
        author_id: Optional[int] = None,
        category_id: Optional[int] = None
    ) -> Tuple[int, Optional[str]]:
        """
        Export a book: export raw HTML files and generate metadata (no text file).

        The optimized flow:
        1. Export raw files to memory (not S3)
        2. Process metadata from in-memory HTML
        3. Upload both raw files and metadata to S3
        4. Export metadata to PostgreSQL

        Returns:
            Tuple of (raw_files_count, metadata_url)
        """
        from scrape import process_book_html

        # Check if already fully exported (raw files + metadata)
        raw_files = self.get_book_files_from_s3(book_id)
        metadata_url = self.get_processed_metadata_url(book_id)

        if raw_files and metadata_url:
            logger.info("Book already exported with metadata", book_id=book_id)
            return len(raw_files), metadata_url

        # If raw files exist but metadata doesn't, download from S3 to process
        if raw_files and not metadata_url:
            html_contents = list(self._stream_raw_html_files(book_id))
            metadata = process_book_html(
                html_contents=html_contents,
                book_id=book_id,
                book_name=book_name,
                author_name=author_name,
                category_name=category_name,
                table_of_contents=table_of_contents
            )
            metadata_url = self._upload_metadata(book_id, metadata)
            self._export_to_postgres(metadata, author_id=author_id, category_id=category_id)
            return len(raw_files), metadata_url

        # Optimized flow: export to memory, process, then upload everything
        if not self.s3_client:
            raise ValueError("S3 client not configured - cannot export without storage")

        # Export raw files to memory
        files_in_memory = self._export_to_memory(book_id)

        # Convert bytes to strings for HTML processing
        html_contents = [
            content.decode("utf-8", errors="ignore")
            for filename, content in sorted(files_in_memory.items())
            if filename.lower().endswith((".htm", ".html"))
        ]

        # Process metadata from in-memory HTML
        metadata = process_book_html(
            html_contents=html_contents,
            book_id=book_id,
            book_name=book_name,
            author_name=author_name,
            category_name=category_name,
            table_of_contents=table_of_contents
        )

        # Upload raw files and metadata to S3
        uploaded_urls = self._upload_raw_files_from_memory(book_id, files_in_memory)
        metadata_url = self._upload_metadata(book_id, metadata)

        # Export to PostgreSQL
        self._export_to_postgres(metadata, author_id=author_id, category_id=category_id)

        return len(uploaded_urls), metadata_url

    async def export_book_with_metadata_async(
        self,
        book_id: int,
        book_name: str,
        author_name: Optional[str],
        category_name: Optional[str],
        table_of_contents: Optional[str] = None,
        author_id: Optional[int] = None,
        category_id: Optional[int] = None
    ) -> Tuple[int, Optional[str]]:
        """
        Async version of export_book_with_metadata for concurrent batch processing.
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            lambda: self.export_book_with_metadata(
                book_id,
                book_name,
                author_name,
                category_name,
                table_of_contents,
                author_id,
                category_id
            )
        )

    async def export_books_batch(
        self,
        books_data: List[Dict[str, Any]],
        max_concurrent: int = 5
    ) -> List[Tuple[int, int, Optional[str], Optional[str]]]:
        """
        Export multiple books concurrently with controlled parallelism.

        Args:
            books_data: List of dicts with book_id, book_name, author_name, category_name,
                        table_of_contents, author_id, category_id
            max_concurrent: Maximum number of books to export concurrently

        Returns:
            List of tuples: (book_id, raw_files_count, metadata_url, error_message)
            error_message is None on success, contains error string on failure
        """
        semaphore = asyncio.Semaphore(max_concurrent)

        async def export_with_semaphore(book_data: Dict[str, Any]) -> Tuple[int, int, Optional[str], Optional[str]]:
            book_id = book_data["book_id"]
            async with semaphore:
                try:
                    raw_files_count, metadata_url = await self.export_book_with_metadata_async(
                        book_id=book_id,
                        book_name=book_data.get("book_name"),
                        author_name=book_data.get("author_name"),
                        category_name=book_data.get("category_name"),
                        table_of_contents=book_data.get("table_of_contents"),
                        author_id=book_data.get("author_id"),
                        category_id=book_data.get("category_id")
                    )
                    return (book_id, raw_files_count, metadata_url, None)
                except Exception as e:
                    logger.error("Failed to export book", book_id=book_id, error=str(e))
                    return (book_id, 0, None, str(e))

        # Export all books concurrently
        tasks = [export_with_semaphore(book_data) for book_data in books_data]
        results = await asyncio.gather(*tasks)

        return list(results)

    def check_export_status(self, book_id: int) -> Tuple[Optional[int], Optional[str]]:
        """
        Check if a book is fully exported (raw files + metadata).
        Returns (raw_files_count, metadata_url) - both set if fully exported, None otherwise.
        """
        raw_files = self.get_book_files_from_s3(book_id)
        metadata_url = self.get_processed_metadata_url(book_id)

        if raw_files and metadata_url:
            return len(raw_files), metadata_url
        return None, None

    def check_books_export_status_batch(self, book_ids: List[int]) -> Dict[int, Tuple[Optional[int], Optional[str]]]:
        """
        Check export status for multiple books efficiently.
        Returns dict mapping book_id to (raw_files_count, metadata_url) tuple.
        """
        results = {}
        for book_id in book_ids:
            results[book_id] = self.check_export_status(book_id)
        return results

    def export_books(self, book_ids: List[int]) -> Tuple[List[str], str]:
        """Export books and upload to S3. Returns (uploaded_files, message).
        DEPRECATED: Use export_book_with_metadata instead for combined export with metadata.
        """
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

    # ============== Processed Text/Metadata Operations ==============

    def get_processed_text_url(self, book_id: int) -> Optional[str]:
        """Check if processed text exists and return its URL."""
        if not self.s3_client:
            return None

        s3_key = f"text/{book_id}.md"
        try:
            self.s3_client.head_object(Bucket=self.s3_bucket, Key=s3_key)
            endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
            return f"https://{self.s3_bucket}.{endpoint_host}/{s3_key}"
        except Exception:
            return None

    def get_processed_metadata_url(self, book_id: int) -> Optional[str]:
        """Check if processed metadata exists and return its URL."""
        if not self.s3_client:
            return None

        s3_key = f"metadata/{book_id}.json"
        try:
            self.s3_client.head_object(Bucket=self.s3_bucket, Key=s3_key)
            endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
            return f"https://{self.s3_bucket}.{endpoint_host}/{s3_key}"
        except Exception:
            return None

    def book_is_processed(self, book_id: int) -> bool:
        """Check if a book has been processed (both text and metadata exist)."""
        return (
            self.get_processed_text_url(book_id) is not None and
            self.get_processed_metadata_url(book_id) is not None
        )

    def check_processed_status(self, book_id: int) -> Tuple[Optional[str], Optional[str]]:
        """
        Check if a book is processed with a single S3 list operation.
        Returns (text_url, metadata_url) - both will be set if processed, None otherwise.
        More efficient than two separate HEAD requests.
        """
        if not self.s3_client:
            return None, None

        text_key = f"text/{book_id}.md"
        metadata_key = f"metadata/{book_id}.json"

        try:
            # Use list_objects_v2 with prefix to check both keys efficiently
            # This is more efficient than two HEAD requests when checking multiple files
            found_text = False
            found_metadata = False

            # Check text file
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=text_key,
                MaxKeys=1
            )
            if "Contents" in response and any(obj["Key"] == text_key for obj in response["Contents"]):
                found_text = True

            # Check metadata file
            response = self.s3_client.list_objects_v2(
                Bucket=self.s3_bucket,
                Prefix=metadata_key,
                MaxKeys=1
            )
            if "Contents" in response and any(obj["Key"] == metadata_key for obj in response["Contents"]):
                found_metadata = True

            if found_text and found_metadata:
                endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
                text_url = f"https://{self.s3_bucket}.{endpoint_host}/{text_key}"
                metadata_url = f"https://{self.s3_bucket}.{endpoint_host}/{metadata_key}"
                return text_url, metadata_url

            return None, None

        except Exception as e:
            logger.warning("Error checking processed status", book_id=book_id, error=str(e))
            return None, None

    def _download_raw_html_files(self, book_id: int) -> List[str]:
        """Download raw HTML files from S3 and return their contents."""
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        s3_prefix = f"raw/{book_id}/"
        html_contents = []

        response = self.s3_client.list_objects_v2(
            Bucket=self.s3_bucket,
            Prefix=s3_prefix
        )

        if "Contents" not in response:
            raise ValueError(f"No raw files found for book {book_id}")

        # Sort by key to maintain file order (001.htm, 002.htm, etc.)
        objects = sorted(response["Contents"], key=lambda x: x["Key"])

        for obj in objects:
            key = obj["Key"]
            if key.lower().endswith((".htm", ".html")):
                file_obj = self.s3_client.get_object(Bucket=self.s3_bucket, Key=key)
                content = file_obj["Body"].read().decode("utf-8", errors="ignore")
                html_contents.append(content)

        logger.info("Downloaded raw HTML files", book_id=book_id, file_count=len(html_contents))
        return html_contents

    def _stream_raw_html_files(self, book_id: int) -> Iterator[str]:
        """
        Stream raw HTML files from S3 one at a time.
        More memory efficient than downloading all files at once.
        """
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        s3_prefix = f"raw/{book_id}/"

        # Use paginator to handle books with many pages (>1000)
        paginator = self.s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=self.s3_bucket, Prefix=s3_prefix)

        all_keys = []
        for page in pages:
            if "Contents" in page:
                for obj in page["Contents"]:
                    key = obj["Key"]
                    if key.lower().endswith((".htm", ".html")):
                        all_keys.append(key)

        if not all_keys:
            raise ValueError(f"No raw files found for book {book_id}")

        # Sort by key to maintain file order (001.htm, 002.htm, etc.)
        all_keys.sort()

        logger.info("Streaming raw HTML files", book_id=book_id, file_count=len(all_keys))

        for key in all_keys:
            file_obj = self.s3_client.get_object(Bucket=self.s3_bucket, Key=key)
            content = file_obj["Body"].read().decode("utf-8", errors="ignore")
            yield content

    def _upload_processed_files(self, book_id: int, text_content: str, metadata: Dict[str, Any]) -> Tuple[str, str]:
        """Upload processed text and metadata to S3."""
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        import json

        # Upload text file
        text_key = f"text/{book_id}.md"
        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=text_key,
            Body=text_content.encode("utf-8"),
            ContentType="text/markdown; charset=utf-8"
        )

        # Upload metadata file
        metadata_key = f"metadata/{book_id}.json"
        self.s3_client.put_object(
            Bucket=self.s3_bucket,
            Key=metadata_key,
            Body=json.dumps(metadata, ensure_ascii=False, indent=2).encode("utf-8"),
            ContentType="application/json; charset=utf-8"
        )

        endpoint_host = self.s3_endpoint.replace("https://", "").replace("http://", "")
        text_url = f"https://{self.s3_bucket}.{endpoint_host}/{text_key}"
        metadata_url = f"https://{self.s3_bucket}.{endpoint_host}/{metadata_key}"

        logger.info("Uploaded processed files", book_id=book_id, text_key=text_key, metadata_key=metadata_key)
        return text_url, metadata_url

    def process_book(
        self,
        book_id: int,
        book_name: str,
        author_name: Optional[str],
        category_name: Optional[str],
        table_of_contents: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Process a book: export if needed, scrape HTML, upload text/metadata.

        Returns:
            Tuple of (text_url, metadata_url)
        """
        from scrape import process_book_html

        # Check if already processed using optimized single check
        text_url, metadata_url = self.check_processed_status(book_id)
        if text_url and metadata_url:
            logger.info("Book already processed", book_id=book_id)
            return text_url, metadata_url

        # Export if not already exported
        if not self.book_exists_in_s3(book_id):
            logger.info("Book not exported, exporting first", book_id=book_id)
            self.export_books([book_id])

        # Use streaming HTML download for memory efficiency
        html_contents = list(self._stream_raw_html_files(book_id))

        # Process HTML to get text and metadata
        text_content, metadata = process_book_html(
            html_contents=html_contents,
            book_id=book_id,
            book_name=book_name,
            author_name=author_name,
            category_name=category_name,
            table_of_contents=table_of_contents
        )

        # Upload processed files
        text_url, metadata_url = self._upload_processed_files(book_id, text_content, metadata)

        return text_url, metadata_url

    async def process_book_async(
        self,
        book_id: int,
        book_name: str,
        author_name: Optional[str],
        category_name: Optional[str],
        table_of_contents: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Async version of process_book for concurrent batch processing.
        Runs the synchronous operations in a thread pool to avoid blocking.

        Returns:
            Tuple of (text_url, metadata_url)
        """
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            _executor,
            self.process_book,
            book_id,
            book_name,
            author_name,
            category_name,
            table_of_contents
        )

    async def process_books_batch(
        self,
        books_data: List[Dict[str, Any]],
        max_concurrent: int = 5
    ) -> List[Tuple[int, Optional[str], Optional[str], Optional[str]]]:
        """
        Process multiple books concurrently with controlled parallelism.

        Args:
            books_data: List of dicts with book_id, book_name, author_name, category_name, table_of_contents
            max_concurrent: Maximum number of books to process concurrently

        Returns:
            List of tuples: (book_id, text_url, metadata_url, error_message)
            error_message is None on success, contains error string on failure
        """
        semaphore = asyncio.Semaphore(max_concurrent)
        results = []

        async def process_with_semaphore(book_data: Dict[str, Any]) -> Tuple[int, Optional[str], Optional[str], Optional[str]]:
            book_id = book_data["book_id"]
            async with semaphore:
                try:
                    text_url, metadata_url = await self.process_book_async(
                        book_id=book_id,
                        book_name=book_data.get("book_name"),
                        author_name=book_data.get("author_name"),
                        category_name=book_data.get("category_name"),
                        table_of_contents=book_data.get("table_of_contents")
                    )
                    return (book_id, text_url, metadata_url, None)
                except Exception as e:
                    logger.error("Failed to process book", book_id=book_id, error=str(e))
                    return (book_id, None, None, str(e))

        # Process all books concurrently
        tasks = [process_with_semaphore(book_data) for book_data in books_data]
        results = await asyncio.gather(*tasks)

        return list(results)

    def check_books_processed_batch(self, book_ids: List[int]) -> Dict[int, Tuple[Optional[str], Optional[str]]]:
        """
        Check processing status for multiple books efficiently.
        Returns dict mapping book_id to (text_url, metadata_url) tuple.
        """
        results = {}
        for book_id in book_ids:
            text_url, metadata_url = self.check_processed_status(book_id)
            results[book_id] = (text_url, metadata_url)
        return results

    def download_texts_as_zip(self, book_ids: List[int]) -> Tuple[io.BytesIO, str]:
        """Download processed text files from S3 and return as a zip file."""
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for book_id in book_ids:
                s3_key = f"text/{book_id}.md"
                try:
                    file_obj = self.s3_client.get_object(Bucket=self.s3_bucket, Key=s3_key)
                    content = file_obj["Body"].read()
                    zip_file.writestr(f"{book_id}.md", content)
                except Exception as e:
                    logger.warning("Text file not found", book_id=book_id, error=str(e))
                    continue

        zip_buffer.seek(0)

        if len(book_ids) == 1:
            filename = f"text_{book_ids[0]}.zip"
        else:
            filename = f"texts_{'-'.join(map(str, book_ids[:5]))}.zip"

        return zip_buffer, filename

    def download_metadata_as_zip(self, book_ids: List[int]) -> Tuple[io.BytesIO, str]:
        """Download processed metadata files from S3 and return as a zip file."""
        if not self.s3_client:
            raise ValueError("S3 client not configured")

        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for book_id in book_ids:
                s3_key = f"metadata/{book_id}.json"
                try:
                    file_obj = self.s3_client.get_object(Bucket=self.s3_bucket, Key=s3_key)
                    content = file_obj["Body"].read()
                    zip_file.writestr(f"{book_id}.json", content)
                except Exception as e:
                    logger.warning("Metadata file not found", book_id=book_id, error=str(e))
                    continue

        zip_buffer.seek(0)

        if len(book_ids) == 1:
            filename = f"metadata_{book_ids[0]}.zip"
        else:
            filename = f"metadata_{'-'.join(map(str, book_ids[:5]))}.zip"

        return zip_buffer, filename
