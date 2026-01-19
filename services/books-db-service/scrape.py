"""HTML scraping and text processing utilities for book exports."""

import json
import re
from collections import defaultdict
from typing import Dict, List, Any, Optional, Tuple
from bs4 import BeautifulSoup, NavigableString, Tag
import structlog

logger = structlog.get_logger()


def ends_with_punctuation(text: str) -> bool:
    """Check if text ends with punctuation."""
    return text.strip().endswith(('.', '؟', '?', '!', '***', '»', ']', '"'))


def starts_with_letter(text: str) -> bool:
    """Check if text starts with an Arabic or Latin letter."""
    return bool(re.match(r"^[\u0621-\u064Aa-zA-Z]", text.strip()))


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


def extract_text_from_page(page_div: Tag) -> Optional[str]:
    """Extract cleaned text from a page div."""
    page_head = page_div.find('div', class_='PageHead')
    if not page_head or not page_head.find('span', class_='PageNumber'):
        return None

    content = ""

    def process_element(elem):
        nonlocal content

        if isinstance(elem, Tag) and page_head in elem.parents:
            return
        if isinstance(elem, Tag) and elem.name == 'div' and 'footnote' in elem.get('class', []):
            return
        if isinstance(elem, Tag) and elem.name == 'sup':
            return

        if isinstance(elem, NavigableString):
            text = elem.strip()
            if not text:
                return
            text = re.sub(r"(?<!^)\(\d+\)", "", text)
            text = re.sub(r"(?<!^)\[\d+\]", "", text)
            text = re.sub(r"⦗ص:\s*\d+⦘", "", text)
            content += text + " "

        elif isinstance(elem, Tag):
            if elem.name == "span" and 'title' in elem.get('class', []):
                text = elem.get_text(strip=True)
                if not text:
                    return
                content += "**" + text + "**" + " "
            elif elem.name == 'p':
                content += "\n\n"
            else:
                for child in elem.contents:
                    process_element(child)

    for child in page_div:
        process_element(child)

    return content.strip()


def process_book_html(
    html_contents: List[str],
    book_id: int,
    book_name: str,
    author_name: Optional[str],
    category_name: Optional[str],
    table_of_contents: Optional[str] = None
) -> Tuple[str, Dict[str, Any]]:
    """
    Process HTML files from an exported book and create cleaned markdown text and metadata.

    Args:
        html_contents: List of HTML file contents as strings
        book_id: The book ID
        book_name: The book name
        author_name: Author name from database
        category_name: Category name from database
        table_of_contents: JSON string of table of contents from database

    Returns:
        Tuple of (markdown_text, metadata_dict)
    """
    full_text = ""
    previous_text = ""
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
            if page.find("div", class_="PageHead") and page.find("div", class_="PageHead").find("span", class_="PartName"):
                page_id += 1 

            current_text = extract_text_from_page(page)
            if not current_text or not current_text.strip():
                continue

            page_head = page.find("div", class_="PageHead")
            page_title = ""
            page_number = None

            if page_head:
                part_name_span = page_head.find("span", class_="PartName")
                
                if part_name_span:
                    page_title = part_name_span.get_text(strip=True)

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
                "header_title": page_title,
                "page_num": page_number,
                "page_id": page_id,
                "cleaned_text": current_text,
                "display_elem": str(page),
            })

            if (
                previous_text
                and not ends_with_punctuation(previous_text)
                and starts_with_letter(current_text)
            ):
                full_text = full_text.rstrip() + " " + current_text.lstrip()
            else:
                full_text += "\n\n" + current_text.strip()

            previous_text = current_text

    # Normalize whitespace
    full_text = re.sub(r"\n{3,}", "\n\n", full_text).strip()

    # Parse table_of_contents if it's a JSON string
    toc_data = None
    if table_of_contents:
        try:
            toc_data = json.loads(table_of_contents)
        except (json.JSONDecodeError, TypeError):
            toc_data = None

    # Build metadata (without "knowledge" field, using category from db)
    metadata = {
        "book_id": book_id,
        "book_name": book_name,
        "author": author_name,
        "category": category_name,
        "table_of_contents": toc_data,
        "headers": headers,
        **optional_metadata,
        "pages": pages,
    }

    logger.info(
        "Processed book HTML",
        book_id=book_id,
        text_length=len(full_text),
        total_headers=len(headers),
        total_pages=sum(len(pages[h]) for h in pages)
    )

    return full_text, metadata
