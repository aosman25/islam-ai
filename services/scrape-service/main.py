from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from typing import List
from collections import defaultdict
from bs4 import BeautifulSoup
from urllib.parse import quote
from io import BytesIO
import pandas as pd
import uuid
import zipfile
import json
import uvicorn
import re

from utils import (
    ends_with_punctuation,
    starts_with_letter,
    extract_optional_metadata,
    extract_text_from_page,
    arabic_to_english_numerals,
)

app = FastAPI()


@app.post("/scrape")
def scrape_book_htms(
    htm_files: List[UploadFile] = File(...),
    book_name: str = Form(...),
    csv_file: UploadFile = File(...),
):
    # Validate HTML files
    for file in htm_files:
        if not file.filename.lower().endswith((".htm", ".html")):
            raise HTTPException(
                status_code=400,
                detail=f"Invalid file type: {file.filename}",
            )

    # Read and decode HTML files once
    decoded_htm_files = [
        upload.file.read().decode("utf-8", errors="ignore")
        for upload in htm_files
    ]

    # Read metadata CSV
    metadata = pd.read_csv(csv_file.file)
    metadata = metadata.set_index("الكتاب")

    if book_name not in metadata.index:
        raise HTTPException(
            status_code=400,
            detail=f"Metadata not found for book: {book_name}",
        )

    knowledge = metadata.loc[book_name, "العلم الشرعي"]
    category = metadata.loc[book_name, "التصنيف"]
    author = metadata.loc[book_name, "المؤلف"]
    book_id = str(uuid.uuid4())

    full_text = ""
    previous_text = ""
    optional_metadata = {}
    headers = []
    headers_set = set()
    pages = defaultdict(lambda: defaultdict(list))

    # Extract optional metadata from first valid HTML
    for html in decoded_htm_files:
        soup = BeautifulSoup(html, "html5lib")
        optional_metadata = extract_optional_metadata(soup)
        if optional_metadata:
            break

    # Process pages
    for html in decoded_htm_files:
        soup = BeautifulSoup(html, "html5lib")
        main_div = soup.find("div", class_="Main")
        if not main_div:
            continue

        page_divs = main_div.find_all("div", class_="PageText")
        for page in page_divs:
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
                            page_number = int(
                                arabic_to_english_numerals(match.group(1))
                            )
                        except Exception:
                            pass

            if page_title not in headers_set:
                headers_set.add(page_title)
                headers.append(page_title)

            pages[page_title][page_number].append(
                {
                    "header_title": page_title,
                    "page_num": page_number,
                    "cleaned_text": current_text,
                    "display_elem": str(page),
                }
            )

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

    # JSON metadata without full_text
    book_info = {
        "book_id": book_id,
        "book_name": book_name,
        "author": author,
        "knowledge": knowledge,
        "category": category,
        "headers": headers,
        **optional_metadata,
        "pages": pages,
    }

    # Build ZIP in memory
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipf.writestr(
            f"{book_name}.md",
            full_text,
        )
        zipf.writestr(
            f"{book_name}.json",
            json.dumps(book_info, ensure_ascii=False, indent=2),
        )

    zip_buffer.seek(0)

    # RFC 5987 safe filename handling
    ascii_fallback = "book.zip"
    utf8_filename = quote(f"{book_name}.zip")

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{ascii_fallback}"; '
                f"filename*=UTF-8''{utf8_filename}"
            )
        },
    )


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        reload=True,
        host="0.0.0.0",
        port=3000,
    )
