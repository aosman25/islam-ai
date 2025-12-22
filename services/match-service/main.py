from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import zipfile
from io import BytesIO
import json
from urllib.parse import quote
from utils import *

app = FastAPI()

@app.post("/match")
async def match_books(
    book_zip: UploadFile = File(...),
    fast_match: bool = True,
):
    if not book_zip.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="ZIP file required")

    zip_bytes = await book_zip.read()

    book_chunks = None
    book_metadata = None
    original_files = {}

    with zipfile.ZipFile(BytesIO(zip_bytes), "r") as z:
        for name in z.namelist():
            content = z.read(name)
            original_files[name] = content

            if name.endswith(".chunks.json"):
                book_chunks = json.loads(
                    content.decode("utf-8", errors="ignore")
                )
            elif name.endswith(".json"):
                book_metadata = json.loads(
                    content.decode("utf-8", errors="ignore")
                )

    if not book_chunks or not book_metadata:
        raise HTTPException(status_code=400, detail="Missing required files")

    book_name = book_metadata.get("book_name", "book")

    page_texts = load_raw_book(book_metadata)
    page_texts.append((page_texts[-1][0], page_texts[-1][1], "END"))

    chunk_pointer, page_pointer = 0, 0
    start_page = page_texts[0][0]
    curr_headers = []

    while page_pointer < len(page_texts) and chunk_pointer < len(book_chunks):
        chunk_text = book_chunks[chunk_pointer]["text"]
        page_num, header_title, page_text = page_texts[page_pointer]

        if header_title not in curr_headers:
            curr_headers.append(header_title)

        if sliding_fuzzy_match(page_text, chunk_text, fast_match=fast_match):
            page_pointer += 1
        else:
            book_chunks[chunk_pointer]["page_range"] = [start_page, page_num]
            book_chunks[chunk_pointer]["header_titles"] = curr_headers
            curr_headers = []
            start_page = page_num
            chunk_pointer += 1
            page_pointer += 1

    if page_pointer >= len(page_texts) and (
        chunk_pointer == len(book_chunks)
        or chunk_pointer == len(book_chunks) - 1
    ):
        for i in range(chunk_pointer, len(book_chunks)):
            if "page_range" not in book_chunks[i]:
                _, end_page = book_chunks[i - 1]["page_range"]
                header_titles = book_chunks[i - 1]["header_titles"]
                book_chunks[i]["page_range"] = [end_page, end_page]
                book_chunks[i]["header_titles"] = header_titles
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to match: {book_name} ({len(book_chunks)} chunks)",
        )

    # -------- ZIP OUTPUT --------

    output_zip = BytesIO()
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for filename, content in original_files.items():
            z.writestr(filename, content)

        match_filename = f"{book_name}.match.json"
        z.writestr(
            match_filename,
            json.dumps(book_chunks, ensure_ascii=False, indent=2),
        )

    output_zip.seek(0)

    safe_zip_name = quote(f"{book_name}.zip")

    return StreamingResponse(
        output_zip,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_zip_name}"
        },
    )
