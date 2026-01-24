"""HTML scraping and text processing utilities for book exports."""

import json
import re
from collections import defaultdict
from typing import Dict, List, Any, Optional
from bs4 import BeautifulSoup
import structlog

logger = structlog.get_logger()


def arabic_to_english_numerals(ar_num: str) -> str:
    """Convert Arabic-Indic digits to English digits."""
    arabic_digits = '٠١٢٣٤٥٦٧٨٩'
    trans_table = str.maketrans(arabic_digits, '0123456789')
    return ar_num.translate(trans_table)


def extract_optional_metadata(soup: BeautifulSoup) -> Dict[str, str]:
    """Extract optional metadata (editor, publisher, etc.) from book HTML."""
    main_div = soup.find('div', class_='Main')
    if not main_div:
        return {}

    for page_div in main_div.find_all('div', class_='PageText'):
        page_head = page_div.find('div', class_='PageHead')
        if page_head and page_head.find('span', class_='PageNumber'):
            continue  # skip normal pages

        metadata = {}

        arabic_to_english = {
            "المحقق": "editor",
            "الطبعة": "edition",
            "الناشر": "publisher",
            "عدد الأجزاء": "num_volumes",
            "عدد الصفحات": "num_pages",
            "تاريخ النشر بالشاملة": "shamela_pub_date",
            "المؤلف": "author_full",
            "المحقق": "editor"
        }

        for p in page_div.find_all('p'):
            title_span = p.find('span', class_='title')
            if title_span:
                key_ar = title_span.get_text(strip=True).replace(":", "")
                key_en = arabic_to_english.get(key_ar)
                if key_en:
                    title_span.extract()
                    value = p.get_text(strip=True)
                    metadata[key_en] = value

        return metadata

    return {}


def process_book_html(
    html_contents: List[str],
    book_id: int,
    book_name: str,
    author_name: Optional[str],
    category_name: Optional[str],
    table_of_contents: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process HTML files from an exported book and create metadata.

    Args:
        html_contents: List of HTML file contents as strings
        book_id: The book ID
        book_name: The book name
        author_name: Author name from database
        category_name: Category name from database
        table_of_contents: JSON string of table of contents from database

    Returns:
        metadata_dict
    """
    optional_metadata = {}
    headers = []
    headers_set = set()
    pages = defaultdict(lambda: defaultdict(list))
    page_id = 0

    # Extract optional metadata from first valid HTML
    for html in html_contents:
        soup = BeautifulSoup(html, "html5lib")
        optional_metadata = extract_optional_metadata(soup)
        if optional_metadata:
            break

    # Process pages
    for html in html_contents:
        soup = BeautifulSoup(html, "html5lib")
        main_div = soup.find("div", class_="Main")
        if not main_div:
            continue

        page_divs = main_div.find_all("div", class_="PageText")
        for page in page_divs:
            page_head = page.find("div", class_="PageHead")
            if page.find("div", class_="PageHead") and page.find("div", class_="PageHead").find("span", class_="PartName"):
                page_id += 1 
            
            if not page_head or not page_head.find("span", class_="PageNumber"):
                continue

            page_title = ""
            page_number = None

            if page_head:
                part_name_span = page_head.find("span", class_="PartName")
                
                if part_name_span:
                    page_title = part_name_span.get_text(strip=True)
                    # Strip book_name first, then extract part identifier
                    if page_title.startswith(book_name):
                        remaining = page_title[len(book_name):].strip()
                        # Extract part number after "جـ" if present, otherwise after "-"
                        part_match = re.search(r"جـ\s*(.+)$", remaining)
                        if part_match:
                            page_title = part_match.group(1).strip()
                        else:
                            dash_match = re.search(r"^-\s*(.+)$", remaining)
                            if dash_match:
                                page_title = dash_match.group(1).strip()

                page_num_span = page_head.find("span", class_="PageNumber")
                if page_num_span:
                    match = re.search(r"ص:\s*([٠-٩\d]+)", page_num_span.get_text())
                    if match:
                        try:
                            page_number = int(arabic_to_english_numerals(match.group(1)))
                        except Exception:
                            pass

            if page_title not in headers_set:
                headers_set.add(page_title)
                headers.append(page_title)

            pages[page_title][page_number].append({
                "part_title": page_title,
                "page_num": page_number,
                "page_id": page_id,
                "display_elem": str(page),
            })

    # Parse table_of_contents if it's a JSON string
    toc_data = None
    if table_of_contents:
        try:
            toc_data = json.loads(table_of_contents)
        except (json.JSONDecodeError, TypeError):
            toc_data = None

    metadata = {
        "book_id": book_id,
        "book_name": book_name,
        "author": author_name,
        "category": category_name,
        **optional_metadata,
        "parts": headers,
        "table_of_contents": toc_data,
        "pages": pages,
    }

    logger.info(
        "Processed book HTML",
        book_id=book_id,
        total_headers=len(headers),
        total_pages=sum(len(pages[h]) for h in pages)
    )

    return metadata