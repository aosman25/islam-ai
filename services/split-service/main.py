from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
import zipfile
from io import BytesIO
import os
from dotenv import load_dotenv
import json
import uvicorn
from encoders import DeepInfraEncoder
from semantic_chunkers import StatisticalChunker
import uuid
from urllib.parse import quote

load_dotenv()

app = FastAPI()

@app.post("/split")
async def split_semantic_text(
    book_zip: UploadFile = File(...),
    deepinfra_api_key: str = os.getenv("DEEPINFRA_API_KEY"),
    model_name: str = "BAAI/bge-m3-multi",
    min_split_tokens: int = 1000,
    max_split_tokens: int = 5000,
    split_tokens_tolerance: int = 0,
):
    if not book_zip.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="ZIP file required")

    zip_bytes = await book_zip.read()

    book_text = None
    book_metadata = None
    original_files = {}

    with zipfile.ZipFile(BytesIO(zip_bytes), "r") as z:
        for name in z.namelist():
            content = z.read(name)
            original_files[name] = content

            if name.endswith(".md"):
                book_text = content.decode("utf-8", errors="ignore")

            elif name.endswith(".json"):
                book_metadata = json.loads(
                    content.decode("utf-8", errors="ignore")
                )

    if not book_text or not book_metadata:
        raise HTTPException(status_code=400, detail="Missing required files")

    book_name = book_metadata.get("book_name", "book")
    book_id = book_metadata.get("book_id", "")
    knowledge = book_metadata.get("knowledge", "")
    category = book_metadata.get("category", "")
    author = book_metadata.get("author", "")

    encoder = DeepInfraEncoder(
        deepinfra_api_key=deepinfra_api_key,
        name=model_name,
    )

    chunker = StatisticalChunker(
        encoder=encoder,
        min_split_tokens=min_split_tokens,
        max_split_tokens=max_split_tokens,
        split_tokens_tolerance=split_tokens_tolerance,
        enable_statistics=False,
    )

    chunks = chunker(docs=[book_text])

    all_chunks = []
    for chunk_list in chunks:
        for chunk in chunk_list:
            all_chunks.append({
                "id": str(uuid.uuid4()),
                "book_id": book_id,
                "book_name": book_name,
                "order": len(all_chunks),
                "author": author,
                "knowledge": knowledge,
                "category": category,
                "text": " ".join(chunk.splits),
            })

    output_zip = BytesIO()
    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        for filename, content in original_files.items():
            z.writestr(filename, content)

        chunks_filename = f"{book_name}.chunks.json"
        z.writestr(
            chunks_filename,
            json.dumps(all_chunks, ensure_ascii=False, indent=2),
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

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        reload=True,
        host="0.0.0.0",
        port=3000,
    )
