#!/usr/bin/env python3
"""
Export shamela4 metadata tables to a SQLite database file.

Exports the following tables:
- category: Book categories
- author: Author information
- book: Book metadata (including table_of_contents as JSON)
- author_book: Author to book relationships
- coauthor_book: Co-author to book relationships
"""

import json
import sqlite3
from pathlib import Path


def get_source_db_path() -> Path:
    """Get the path to the shamela4 master.db file."""
    return Path(__file__).parent / "shamela4" / "database" / "master.db"


def get_titles_db_path() -> Path:
    """Get the path to the extracted titles database."""
    return Path(__file__).parent / "extracted_titles.db"


def get_book_db_path(book_id: int) -> Path:
    """Get the path to a specific book's database file."""
    subdir = f"{book_id % 1000:03d}"
    return Path(__file__).parent / "shamela4" / "database" / "book" / subdir / f"{book_id}.db"


def load_title_texts(book_id: int, titles_conn: sqlite3.Connection) -> dict[int, str]:
    """
    Load title texts for a book from the extracted titles database.

    Returns a dict mapping title_id to title text.
    """
    cursor = titles_conn.cursor()
    cursor.execute(
        "SELECT title_id, title FROM title_text WHERE book_id = ?",
        (book_id,)
    )
    return {row[0]: row[1] for row in cursor.fetchall()}


def get_book_toc(book_id: int, titles_conn: sqlite3.Connection | None = None) -> list[dict] | None:
    """
    Extract the table of contents from a book's database.

    The TOC is stored in the 'title' table with columns:
    - id: Unique identifier for each TOC entry
    - page: The page row ID where this section starts (references page.id)
    - parent: Hierarchical reference (0 = top-level, >0 = subsection)

    Joins with the 'page' table to get:
    - part: The volume/part number
    - physical_page: The actual page number within that part

    If titles_conn is provided, also includes the title text from the extracted titles database.

    Returns a list of dicts with id, page, parent, part, physical_page, and optionally title fields,
    or None if book DB doesn't exist.
    """
    book_db = get_book_db_path(book_id)

    if not book_db.exists():
        return None

    try:
        conn = sqlite3.connect(book_db)
        cursor = conn.cursor()

        # Check if title table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='title'")
        if not cursor.fetchone():
            conn.close()
            return None

        # Extract TOC entries with page info by joining with page table
        cursor.execute("""
            SELECT t.id, t.page, t.parent, p.part, p.page as physical_page
            FROM title t
            LEFT JOIN page p ON t.page = p.id
            ORDER BY t.id
        """)
        rows = cursor.fetchall()
        conn.close()

        if not rows:
            return None

        # Load title texts if connection provided
        title_texts = {}
        if titles_conn:
            title_texts = load_title_texts(book_id, titles_conn)

        # Convert to list of dicts, including title text if available
        toc = []
        for row in rows:
            entry = {
                "id": row[0],
                "page": row[1],
                "parent": row[2],
                "part": row[3],
                "physical_page": row[4]
            }
            if row[0] in title_texts:
                entry["title"] = title_texts[row[0]]
            toc.append(entry)

        return toc

    except sqlite3.Error:
        return None


def create_output_schema(conn: sqlite3.Connection) -> None:
    """Create the schema for the output database."""
    cursor = conn.cursor()

    # Create category table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS category (
            category_id INTEGER PRIMARY KEY,
            category_name TEXT,
            category_order INTEGER
        )
    """)

    # Create author table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS author (
            author_id INTEGER PRIMARY KEY,
            author_name TEXT,
            death_number INTEGER,
            death_text TEXT,
            alpha INTEGER
        )
    """)

    # Create book table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS book (
            book_id INTEGER PRIMARY KEY,
            book_name TEXT,
            book_category INTEGER,
            book_type INTEGER,
            book_date INTEGER,
            authors TEXT,
            main_author INTEGER,
            printed INTEGER,
            group_id INTEGER,
            hidden INTEGER,
            major_online INTEGER,
            minor_online INTEGER,
            major_ondisk INTEGER,
            minor_ondisk INTEGER,
            pdf_links TEXT,
            pdf_ondisk INTEGER,
            pdf_online INTEGER,
            cover_ondisk INTEGER,
            cover_online INTEGER,
            meta_data TEXT,
            parent INTEGER,
            alpha INTEGER,
            group_order INTEGER,
            book_up INTEGER,
            table_of_contents TEXT,
            FOREIGN KEY (book_category) REFERENCES category(category_id),
            FOREIGN KEY (main_author) REFERENCES author(author_id)
        )
    """)

    # Create author_book relationship table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS author_book (
            author_id INTEGER,
            book_id INTEGER,
            PRIMARY KEY (author_id, book_id),
            FOREIGN KEY (author_id) REFERENCES author(author_id),
            FOREIGN KEY (book_id) REFERENCES book(book_id)
        )
    """)

    # Create coauthor_book relationship table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS coauthor_book (
            author_id INTEGER,
            book_id INTEGER,
            PRIMARY KEY (author_id, book_id),
            FOREIGN KEY (author_id) REFERENCES author(author_id),
            FOREIGN KEY (book_id) REFERENCES book(book_id)
        )
    """)

    conn.commit()


def create_indexes(conn: sqlite3.Connection) -> None:
    """Create indexes for efficient querying."""
    cursor = conn.cursor()

    # Category indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_category_order ON category(category_order)")

    # Author indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_author_death ON author(death_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_author_alpha ON author(alpha)")

    # Book indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_book_category ON book(book_category)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_book_type ON book(book_type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_book_main_author ON book(main_author)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_book_hidden ON book(hidden)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_book_alpha ON book(alpha)")

    # Relationship indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_author_book_author ON author_book(author_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_author_book_book ON author_book(book_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_coauthor_book_author ON coauthor_book(author_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_coauthor_book_book ON coauthor_book(book_id)")

    conn.commit()


def export_table(
    source_conn: sqlite3.Connection,
    dest_conn: sqlite3.Connection,
    table_name: str,
    columns: list[str]
) -> int:
    """
    Export a table from source to destination database.

    Args:
        source_conn: Source database connection
        dest_conn: Destination database connection
        table_name: Name of the table to export
        columns: List of column names

    Returns:
        Number of rows exported
    """
    source_cursor = source_conn.cursor()
    dest_cursor = dest_conn.cursor()

    # Read all data from source
    columns_str = ", ".join(columns)
    source_cursor.execute(f"SELECT {columns_str} FROM {table_name}")
    rows = source_cursor.fetchall()

    # Insert into destination
    placeholders = ", ".join(["?" for _ in columns])
    dest_cursor.executemany(
        f"INSERT OR REPLACE INTO {table_name} ({columns_str}) VALUES ({placeholders})",
        rows
    )

    dest_conn.commit()
    return len(rows)


def export_book_tocs(dest_conn: sqlite3.Connection) -> None:
    """
    Export table of contents for all books in the destination database.

    Reads the TOC from each book's individual database and updates
    the book table with the table_of_contents JSON. Also includes
    title text from the extracted titles database if available.
    """
    cursor = dest_conn.cursor()

    # Get all book IDs
    cursor.execute("SELECT book_id FROM book")
    book_ids = [row[0] for row in cursor.fetchall()]

    # Open titles database if it exists
    titles_db = get_titles_db_path()
    titles_conn = None
    if titles_db.exists():
        titles_conn = sqlite3.connect(titles_db)
        print(f"  Using title texts from: {titles_db}")
    else:
        print(f"  Warning: Title texts database not found at {titles_db}")
        print(f"  Run TitleExtractor.java first to extract title texts from Lucene index")

    try:
        toc_count = 0
        for book_id in book_ids:
            toc = get_book_toc(book_id, titles_conn)
            if toc:
                toc_json = json.dumps(toc, ensure_ascii=False)
                cursor.execute(
                    "UPDATE book SET table_of_contents = ? WHERE book_id = ?",
                    (toc_json, book_id)
                )
                toc_count += 1

        dest_conn.commit()
        print(f"  Added table of contents for {toc_count:,} books")
    finally:
        if titles_conn:
            titles_conn.close()


def export_metadata(output_path: str | Path | None = None) -> Path:
    """
    Export all metadata tables from shamela4 to a new SQLite database.

    Args:
        output_path: Optional path for the output database file.
                    If not provided, creates 'shamela_metadata.db' in the current directory.

    Returns:
        Path to the created database file.
    """
    source_db = get_source_db_path()

    if not source_db.exists():
        raise FileNotFoundError(f"Source database not found: {source_db}")

    if output_path is None:
        output_path = Path(__file__).parent / "shamela_metadata.db"
    else:
        output_path = Path(output_path)

    # Remove existing output file if it exists
    if output_path.exists():
        output_path.unlink()

    print(f"Exporting from: {source_db}")
    print(f"Exporting to: {output_path}")
    print()

    # Connect to source and destination databases
    source_conn = sqlite3.connect(source_db)
    dest_conn = sqlite3.connect(output_path)

    try:
        # Create schema
        print("Creating schema...")
        create_output_schema(dest_conn)

        # Define tables and their columns
        tables = {
            "category": ["category_id", "category_name", "category_order"],
            "author": ["author_id", "author_name", "death_number", "death_text", "alpha"],
            "book": [
                "book_id", "book_name", "book_category", "book_type", "book_date",
                "authors", "main_author", "printed", "group_id", "hidden",
                "major_online", "minor_online", "major_ondisk", "minor_ondisk",
                "pdf_links", "pdf_ondisk", "pdf_online", "cover_ondisk", "cover_online",
                "meta_data", "parent", "alpha", "group_order", "book_up"
            ],
            "author_book": ["author_id", "book_id"],
            "coauthor_book": ["author_id", "book_id"],
        }

        # Export each table
        for table_name, columns in tables.items():
            count = export_table(source_conn, dest_conn, table_name, columns)
            print(f"Exported {count:,} rows from {table_name}")

        # Export table of contents for each book
        print("\nExporting table of contents for each book...")
        export_book_tocs(dest_conn)

        # Create indexes
        print("\nCreating indexes...")
        create_indexes(dest_conn)

        print("\nExport completed successfully!")

        # Print summary statistics
        print("\n" + "=" * 50)
        print("Summary:")
        print("=" * 50)

        dest_cursor = dest_conn.cursor()
        for table_name in tables:
            dest_cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            count = dest_cursor.fetchone()[0]
            print(f"  {table_name}: {count:,} rows")

        # Get file size
        file_size = output_path.stat().st_size
        print(f"\nOutput file size: {file_size / 1024:.1f} KB")

    finally:
        source_conn.close()
        dest_conn.close()

    return output_path


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Export shamela4 metadata to SQLite database"
    )
    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output database file path (default: shamela_metadata.db)"
    )

    args = parser.parse_args()

    try:
        output_path = export_metadata(args.output)
        print(f"\nDatabase created at: {output_path}")
    except FileNotFoundError as e:
        print(f"Error: {e}")
        exit(1)
    except Exception as e:
        print(f"Error: {e}")
        exit(1)
