"""PostgreSQL service for exporting book metadata."""

import json
from typing import Dict, Any, Optional, List
from contextlib import contextmanager
import structlog
import psycopg2
from psycopg2.extras import execute_values

logger = structlog.get_logger()


class PostgresService:
    """Service for exporting book metadata to PostgreSQL."""

    def __init__(
        self,
        host: str,
        port: int,
        database: str,
        user: str,
        password: str
    ):
        self.connection_params = {
            "host": host,
            "port": port,
            "database": database,
            "user": user,
            "password": password
        }
        self._ensure_database()
        self._ensure_tables()

    def _ensure_database(self):
        """Create the database if it doesn't exist."""
        database = self.connection_params["database"]

        # Connect to default 'postgres' database to check/create our database
        conn = psycopg2.connect(
            host=self.connection_params["host"],
            port=self.connection_params["port"],
            database="postgres",
            user=self.connection_params["user"],
            password=self.connection_params["password"]
        )
        conn.autocommit = True  # CREATE DATABASE cannot run inside a transaction

        try:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (database,)
            )
            if not cursor.fetchone():
                cursor.execute(f'CREATE DATABASE "{database}"')
                logger.info("Created PostgreSQL database", database=database)
            cursor.close()
        finally:
            conn.close()

    @contextmanager
    def get_connection(self):
        """Context manager for database connections."""
        conn = psycopg2.connect(**self.connection_params)
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _ensure_tables(self):
        """Create tables if they don't exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Authors table - uses same IDs as shamela_metadata.db
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS authors (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL
                )
            """)

            # Categories table - uses same IDs as shamela_metadata.db
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS categories (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL
                )
            """)

            # Books table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS books (
                    book_id INTEGER PRIMARY KEY,
                    book_name TEXT,
                    author_id INTEGER REFERENCES authors(id),
                    category_id INTEGER REFERENCES categories(id),
                    editor TEXT,
                    edition TEXT,
                    publisher TEXT,
                    num_volumes TEXT,
                    num_pages TEXT,
                    shamela_pub_date TEXT,
                    author_full TEXT,
                    parts JSONB,
                    table_of_contents JSONB,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Pages table with composite primary key
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS pages (
                    book_id INTEGER NOT NULL REFERENCES books(book_id) ON DELETE CASCADE,
                    page_id INTEGER NOT NULL,
                    part_title TEXT,
                    page_num INTEGER,
                    display_elem TEXT,
                    PRIMARY KEY (book_id, page_id)
                )
            """)

            # Create indexes for better query performance
            # Note: PRIMARY KEY (book_id, page_id) already provides an index for
            # queries filtering by book_id and ordering by page_id (offset pagination)

            # Index for paginating by page_num within a book
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pages_book_page_num ON pages(book_id, page_num)
            """)

            # Index for filtering pages by part_title
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_pages_book_part ON pages(book_id, part_title)
            """)

            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_books_author_id ON books(author_id)
            """)
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_books_category_id ON books(category_id)
            """)

            # Stats table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS stats (
                    book_id INTEGER PRIMARY KEY REFERENCES books(book_id) ON DELETE CASCADE,

                    -- Chunk counts
                    total_chunks INTEGER NOT NULL,
                    segments_under_limit INTEGER,
                    segments_over_limit INTEGER,

                    -- Token statistics
                    total_tokens BIGINT,
                    min_tokens INTEGER,
                    max_tokens INTEGER,
                    avg_tokens FLOAT,
                    median_tokens FLOAT,
                    stddev_tokens FLOAT,
                    p25_tokens FLOAT,
                    p75_tokens FLOAT,
                    p90_tokens FLOAT,
                    p95_tokens FLOAT,

                    -- Character statistics
                    total_characters BIGINT,
                    min_characters INTEGER,
                    max_characters INTEGER,
                    avg_characters FLOAT,
                    median_characters FLOAT,

                    -- Word statistics
                    total_words BIGINT,
                    min_words INTEGER,
                    max_words INTEGER,
                    avg_words FLOAT,
                    median_words FLOAT,

                    -- Embedding statistics
                    avg_sparse_vector_nnz FLOAT,
                    min_sparse_vector_nnz INTEGER,
                    max_sparse_vector_nnz INTEGER,
                    total_sparse_entries BIGINT,

                    -- Page coverage
                    min_page_offset INTEGER,
                    max_page_offset INTEGER,
                    avg_page_offset FLOAT,

                    -- Content analysis
                    avg_chunk_length_chars FLOAT,
                    chunk_length_variance FLOAT,

                    -- Timestamps
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)

            logger.info("PostgreSQL tables ensured")

    def _ensure_author(self, cursor, author_id: Optional[int], author_name: Optional[str]) -> Optional[int]:
        """Ensure author exists with the given ID. Returns author ID."""
        if not author_id or not author_name:
            return None

        cursor.execute(
            "SELECT id FROM authors WHERE id = %s",
            (author_id,)
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO authors (id, name) VALUES (%s, %s)",
                (author_id, author_name)
            )

        return author_id

    def _ensure_category(self, cursor, category_id: Optional[int], category_name: Optional[str]) -> Optional[int]:
        """Ensure category exists with the given ID. Returns category ID."""
        if not category_id or not category_name:
            return None

        cursor.execute(
            "SELECT id FROM categories WHERE id = %s",
            (category_id,)
        )
        if not cursor.fetchone():
            cursor.execute(
                "INSERT INTO categories (id, name) VALUES (%s, %s)",
                (category_id, category_name)
            )

        return category_id

    def export_book_metadata(
        self,
        metadata: Dict[str, Any],
        author_id: Optional[int] = None,
        category_id: Optional[int] = None
    ) -> None:
        """
        Export book metadata to PostgreSQL.

        Args:
            metadata: Dictionary containing book metadata from scrape.py
                Expected keys: book_id, book_name, author, category, editor,
                edition, publisher, num_volumes, num_pages, shamela_pub_date,
                author_full, parts, table_of_contents, pages
            author_id: Author ID from shamela_metadata.db
            category_id: Category ID from shamela_metadata.db
        """
        book_id = metadata.get("book_id")
        if not book_id:
            raise ValueError("book_id is required in metadata")

        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Ensure author and category exist with their original IDs
            self._ensure_author(cursor, author_id, metadata.get("author"))
            self._ensure_category(cursor, category_id, metadata.get("category"))

            # Upsert book record
            cursor.execute("""
                INSERT INTO books (
                    book_id, book_name, author_id, category_id,
                    editor, edition, publisher, num_volumes, num_pages,
                    shamela_pub_date, author_full, parts, table_of_contents,
                    updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP
                )
                ON CONFLICT (book_id) DO UPDATE SET
                    book_name = EXCLUDED.book_name,
                    author_id = EXCLUDED.author_id,
                    category_id = EXCLUDED.category_id,
                    editor = EXCLUDED.editor,
                    edition = EXCLUDED.edition,
                    publisher = EXCLUDED.publisher,
                    num_volumes = EXCLUDED.num_volumes,
                    num_pages = EXCLUDED.num_pages,
                    shamela_pub_date = EXCLUDED.shamela_pub_date,
                    author_full = EXCLUDED.author_full,
                    parts = EXCLUDED.parts,
                    table_of_contents = EXCLUDED.table_of_contents,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                book_id,
                metadata.get("book_name"),
                author_id,
                category_id,
                metadata.get("editor"),
                metadata.get("edition"),
                metadata.get("publisher"),
                metadata.get("num_volumes"),
                metadata.get("num_pages"),
                metadata.get("shamela_pub_date"),
                metadata.get("author_full"),
                json.dumps(metadata.get("parts", []), ensure_ascii=False),
                json.dumps(metadata.get("table_of_contents"), ensure_ascii=False) if metadata.get("table_of_contents") else None
            ))

            # Delete existing pages for this book (for clean re-export)
            cursor.execute("DELETE FROM pages WHERE book_id = %s", (book_id,))

            # Insert pages
            pages_data = metadata.get("pages", {})
            if pages_data:
                page_records = []
                for part_title, page_list in pages_data.items():
                    for page in page_list:
                        page_records.append((
                            book_id,
                            page.get("page_id"),
                            page.get("part_title"),
                            page.get("page_num"),
                            page.get("display_elem")
                        ))

                if page_records:
                    execute_values(
                        cursor,
                        """
                        INSERT INTO pages (book_id, page_id, part_title, page_num, display_elem)
                        VALUES %s
                        """,
                        page_records
                    )

            logger.info(
                "Exported book metadata to PostgreSQL",
                book_id=book_id,
                page_count=len(page_records) if pages_data else 0
            )

    def book_exists(self, book_id: int) -> bool:
        """Check if a book already exists in the database."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM books WHERE book_id = %s", (book_id,))
            return cursor.fetchone() is not None

    def get_book(self, book_id: int) -> Optional[Dict[str, Any]]:
        """Get book metadata from PostgreSQL."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    b.book_id, b.book_name, a.name as author, c.name as category,
                    b.editor, b.edition, b.publisher, b.num_volumes, b.num_pages,
                    b.shamela_pub_date, b.author_full, b.parts, b.table_of_contents
                FROM books b
                LEFT JOIN authors a ON b.author_id = a.id
                LEFT JOIN categories c ON b.category_id = c.id
                WHERE b.book_id = %s
            """, (book_id,))

            row = cursor.fetchone()
            if not row:
                return None

            return {
                "book_id": row[0],
                "book_name": row[1],
                "author": row[2],
                "category": row[3],
                "editor": row[4],
                "edition": row[5],
                "publisher": row[6],
                "num_volumes": row[7],
                "num_pages": row[8],
                "shamela_pub_date": row[9],
                "author_full": row[10],
                "parts": row[11],
                "table_of_contents": row[12]
            }

    def get_book_pages(self, book_id: int) -> List[Dict[str, Any]]:
        """Get all pages for a book."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT page_id, part_title, page_num, display_elem
                FROM pages
                WHERE book_id = %s
                ORDER BY page_id
            """, (book_id,))

            return [
                {
                    "page_id": row[0],
                    "part_title": row[1],
                    "page_num": row[2],
                    "display_elem": row[3]
                }
                for row in cursor.fetchall()
            ]

    def delete_book(self, book_id: int) -> bool:
        """
        Delete a book and its pages from the database.
        Also cleans up orphaned authors and categories.

        Returns:
            True if book was deleted, False if it didn't exist
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            # Get author_id and category_id before deleting
            cursor.execute(
                "SELECT author_id, category_id FROM books WHERE book_id = %s",
                (book_id,)
            )
            result = cursor.fetchone()

            if not result:
                return False

            author_id, category_id = result

            # Delete pages (cascade should handle this, but be explicit)
            cursor.execute("DELETE FROM pages WHERE book_id = %s", (book_id,))

            # Delete the book
            cursor.execute("DELETE FROM books WHERE book_id = %s", (book_id,))

            # Clean up orphaned author if no other books reference it
            if author_id:
                cursor.execute(
                    "SELECT 1 FROM books WHERE author_id = %s LIMIT 1",
                    (author_id,)
                )
                if not cursor.fetchone():
                    cursor.execute("DELETE FROM authors WHERE id = %s", (author_id,))
                    logger.info("Deleted orphaned author", author_id=author_id)

            # Clean up orphaned category if no other books reference it
            if category_id:
                cursor.execute(
                    "SELECT 1 FROM books WHERE category_id = %s LIMIT 1",
                    (category_id,)
                )
                if not cursor.fetchone():
                    cursor.execute("DELETE FROM categories WHERE id = %s", (category_id,))
                    logger.info("Deleted orphaned category", category_id=category_id)

            logger.info("Deleted book from PostgreSQL", book_id=book_id)
            return True

    def save_stats(self, book_id: int, stats: Dict[str, Any]) -> None:
        """
        Save statistics for a book.

        Args:
            book_id: The book ID
            stats: Dictionary containing statistics
        """
        with self.get_connection() as conn:
            cursor = conn.cursor()

            cursor.execute("""
                INSERT INTO stats (
                    book_id,
                    total_chunks, segments_under_limit, segments_over_limit,
                    total_tokens, min_tokens, max_tokens, avg_tokens, median_tokens,
                    stddev_tokens, p25_tokens, p75_tokens, p90_tokens, p95_tokens,
                    total_characters, min_characters, max_characters, avg_characters, median_characters,
                    total_words, min_words, max_words, avg_words, median_words,
                    avg_sparse_vector_nnz, min_sparse_vector_nnz,
                    max_sparse_vector_nnz, total_sparse_entries,
                    min_page_offset, max_page_offset, avg_page_offset,
                    avg_chunk_length_chars, chunk_length_variance,
                    updated_at
                ) VALUES (
                    %s,
                    %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (book_id) DO UPDATE SET
                    total_chunks = EXCLUDED.total_chunks,
                    segments_under_limit = EXCLUDED.segments_under_limit,
                    segments_over_limit = EXCLUDED.segments_over_limit,
                    total_tokens = EXCLUDED.total_tokens,
                    min_tokens = EXCLUDED.min_tokens,
                    max_tokens = EXCLUDED.max_tokens,
                    avg_tokens = EXCLUDED.avg_tokens,
                    median_tokens = EXCLUDED.median_tokens,
                    stddev_tokens = EXCLUDED.stddev_tokens,
                    p25_tokens = EXCLUDED.p25_tokens,
                    p75_tokens = EXCLUDED.p75_tokens,
                    p90_tokens = EXCLUDED.p90_tokens,
                    p95_tokens = EXCLUDED.p95_tokens,
                    total_characters = EXCLUDED.total_characters,
                    min_characters = EXCLUDED.min_characters,
                    max_characters = EXCLUDED.max_characters,
                    avg_characters = EXCLUDED.avg_characters,
                    median_characters = EXCLUDED.median_characters,
                    total_words = EXCLUDED.total_words,
                    min_words = EXCLUDED.min_words,
                    max_words = EXCLUDED.max_words,
                    avg_words = EXCLUDED.avg_words,
                    median_words = EXCLUDED.median_words,
                    avg_sparse_vector_nnz = EXCLUDED.avg_sparse_vector_nnz,
                    min_sparse_vector_nnz = EXCLUDED.min_sparse_vector_nnz,
                    max_sparse_vector_nnz = EXCLUDED.max_sparse_vector_nnz,
                    total_sparse_entries = EXCLUDED.total_sparse_entries,
                    min_page_offset = EXCLUDED.min_page_offset,
                    max_page_offset = EXCLUDED.max_page_offset,
                    avg_page_offset = EXCLUDED.avg_page_offset,
                    avg_chunk_length_chars = EXCLUDED.avg_chunk_length_chars,
                    chunk_length_variance = EXCLUDED.chunk_length_variance,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                book_id,
                stats.get("total_chunks"),
                stats.get("segments_under_limit"),
                stats.get("segments_over_limit"),
                stats.get("total_tokens"),
                stats.get("min_tokens"),
                stats.get("max_tokens"),
                stats.get("avg_tokens"),
                stats.get("median_tokens"),
                stats.get("stddev_tokens"),
                stats.get("p25_tokens"),
                stats.get("p75_tokens"),
                stats.get("p90_tokens"),
                stats.get("p95_tokens"),
                stats.get("total_characters"),
                stats.get("min_characters"),
                stats.get("max_characters"),
                stats.get("avg_characters"),
                stats.get("median_characters"),
                stats.get("total_words"),
                stats.get("min_words"),
                stats.get("max_words"),
                stats.get("avg_words"),
                stats.get("median_words"),
                stats.get("avg_sparse_vector_nnz"),
                stats.get("min_sparse_vector_nnz"),
                stats.get("max_sparse_vector_nnz"),
                stats.get("total_sparse_entries"),
                stats.get("min_page_offset"),
                stats.get("max_page_offset"),
                stats.get("avg_page_offset"),
                stats.get("avg_chunk_length_chars"),
                stats.get("chunk_length_variance"),
            ))

            logger.info("Saved stats to PostgreSQL", book_id=book_id, total_chunks=stats.get("total_chunks"))

    def get_stats(self, book_id: int) -> Optional[Dict[str, Any]]:
        """Get statistics for a book."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT
                    book_id, total_chunks, segments_under_limit, segments_over_limit,
                    total_tokens, min_tokens, max_tokens, avg_tokens, median_tokens,
                    stddev_tokens, p25_tokens, p75_tokens, p90_tokens, p95_tokens,
                    total_characters, min_characters, max_characters, avg_characters, median_characters,
                    total_words, min_words, max_words, avg_words, median_words,
                    avg_sparse_vector_nnz, min_sparse_vector_nnz,
                    max_sparse_vector_nnz, total_sparse_entries,
                    min_page_offset, max_page_offset, avg_page_offset,
                    avg_chunk_length_chars, chunk_length_variance,
                    created_at, updated_at
                FROM stats
                WHERE book_id = %s
            """, (book_id,))

            row = cursor.fetchone()
            if not row:
                return None

            return {
                "book_id": row[0],
                "total_chunks": row[1],
                "segments_under_limit": row[2],
                "segments_over_limit": row[3],
                "total_tokens": row[4],
                "min_tokens": row[5],
                "max_tokens": row[6],
                "avg_tokens": row[7],
                "median_tokens": row[8],
                "stddev_tokens": row[9],
                "p25_tokens": row[10],
                "p75_tokens": row[11],
                "p90_tokens": row[12],
                "p95_tokens": row[13],
                "total_characters": row[14],
                "min_characters": row[15],
                "max_characters": row[16],
                "avg_characters": row[17],
                "median_characters": row[18],
                "total_words": row[19],
                "min_words": row[20],
                "max_words": row[21],
                "avg_words": row[22],
                "median_words": row[23],
                "avg_sparse_vector_nnz": row[24],
                "min_sparse_vector_nnz": row[25],
                "max_sparse_vector_nnz": row[26],
                "total_sparse_entries": row[27],
                "min_page_offset": row[28],
                "max_page_offset": row[29],
                "avg_page_offset": row[30],
                "avg_chunk_length_chars": row[31],
                "chunk_length_variance": row[32],
                "created_at": row[33],
                "updated_at": row[34],
            }
