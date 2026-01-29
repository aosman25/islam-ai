"""Embedding service for chunking and embedding book content."""

import asyncio
import json
import re
import unicodedata
from typing import Callable, Dict, List, Any, Optional

import httpx
import structlog
import tiktoken
from chonkie import SentenceChunker
from tqdm import tqdm

logger = structlog.get_logger()

# Tokenizer configuration
TOKENIZER_MODEL = "o200k_base"
MAX_CHUNK_TOKENS = 7500


_tiktoken_encoder = tiktoken.get_encoding(TOKENIZER_MODEL)


def count_tokens(text: str) -> int:
    """Count tokens in text using tiktoken."""
    return len(_tiktoken_encoder.encode(text))


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


_RE_FOOTNOTE = re.compile(r'<div class="footnote">.*?</div>', re.DOTALL)
_RE_PAGEHEAD = re.compile(r'<div class="PageHead">.*?</div>', re.DOTALL)
_RE_SUP = re.compile(r'<sup[^>]*>.*?</sup>', re.DOTALL)
_RE_SUB = re.compile(r'<sub[^>]*>.*?</sub>', re.DOTALL)
_RE_EMPTY_P = re.compile(r'<p></p>')
_RE_BR = re.compile(r'<br\s*/?>')
_RE_HR = re.compile(r'<hr[^>]*/>')
_RE_ALL_TAGS = re.compile(r'<[^>]+>')
_RE_MULTI_NEWLINE = re.compile(r'\n{3,}')


def strip_html(html: str) -> str:
    """Remove HTML tags and convert to plain text."""
    html = _RE_FOOTNOTE.sub('', html)
    html = _RE_PAGEHEAD.sub('', html)
    html = _RE_SUP.sub('', html)
    html = _RE_SUB.sub('', html)
    html = _RE_EMPTY_P.sub('\n\n', html)
    html = _RE_BR.sub('\n', html)
    html = _RE_HR.sub('', html)
    html = _RE_ALL_TAGS.sub('', html)
    html = _RE_MULTI_NEWLINE.sub('\n\n', html)
    return html.strip()


_RE_DIACRITICS = re.compile(r'[\u064B-\u065F\u0610-\u061A\u06D6-\u06ED]')
_RE_TATWEEL = re.compile(r'ـ')
_RE_INVISIBLE = re.compile(r'[\u200c\u200d\u200e\u200f\u00ad\u200b\ufeff]')
_RE_CONTROL = re.compile(r'[\u0000-\u001F\u007F-\u009F]')
_RE_NON_ALPHANUM = re.compile(r'[^\u0621-\u064A\u0660-\u0669\u06F0-\u06F9a-zA-Z0-9]')
_RE_WHITESPACE = re.compile(r'\s+')


def clean_arabic_text(text: str) -> str:
    """
    Strict normalization that only keeps pure text content for accurate length matching.
    Removes all decorative marks, control characters, punctuation, and whitespace.
    """
    text = unicodedata.normalize("NFKC", text)
    text = _RE_DIACRITICS.sub('', text)
    text = _RE_TATWEEL.sub('', text)
    text = _RE_INVISIBLE.sub('', text)
    text = _RE_CONTROL.sub('', text)
    text = _RE_NON_ALPHANUM.sub('', text)
    text = _RE_WHITESPACE.sub('', text)
    return text


_RE_PERIOD_BOUNDARY = re.compile(r'\.(?=\s*<|\s+[^\s<])')


def find_sentence_boundary_before(html: str, pos: int) -> int:
    """Find the position of the sentence start before the given position.

    Looks for sentence boundaries like periods, paragraph tags, or page starts.
    Returns the position where the new sentence/section begins.
    """
    best_pos = 0

    # Find the last paragraph break <p></p> before pos using rfind (O(n) single pass)
    para_idx = html.rfind('<p></p>', 0, pos)
    if para_idx != -1:
        best_pos = max(best_pos, para_idx + len('<p></p>'))

    # Find the last page div start before pos using rfind
    page_idx = html.rfind('<div class="PageText">', 0, pos)
    if page_idx != -1:
        best_pos = max(best_pos, page_idx + len('<div class="PageText">'))

    # Find the last period followed by a tag or space in a limited window before pos
    # (searching a small window avoids scanning megabytes of text)
    window_start = max(0, pos - 50000)
    search_region = html[window_start:pos]
    period_match = None
    for m in _RE_PERIOD_BOUNDARY.finditer(search_region):
        period_match = m
    if period_match:
        best_pos = max(best_pos, window_start + period_match.end())

    return best_pos


def split_trailing_colon_content(text: str) -> tuple:
    """If text ends with colon, split off all trailing content ending with colons.

    Returns (text_before, colon_content).
    If no colon at end, returns (text, "").
    """
    text = text.rstrip()
    if not text.endswith(':'):
        return text, ""

    colon_parts = []

    while text.rstrip().endswith(':'):
        text = text.rstrip()

        # Find the start of the sentence/line containing the colon
        last_period = -1
        for i in range(len(text) - 2, -1, -1):
            if text[i] == '.' and (i + 1 >= len(text) or text[i + 1] in ' \n\t\r'):
                last_period = i
                break

        last_newline = text.rfind('\n')
        split_pos = max(last_period, last_newline)

        if split_pos == -1:
            colon_parts.insert(0, text)
            text = ""
            break

        colon_part = text[split_pos + 1:].strip()
        colon_parts.insert(0, colon_part)
        text = text[:split_pos + 1].rstrip()

    colon_content = "\n\n".join(colon_parts) if colon_parts else ""
    return text, colon_content


class BookChunker:
    """Handles chunking of book content based on TOC markers and semantic boundaries."""

    def __init__(self, chunk_size: int = MAX_CHUNK_TOKENS, chunk_overlap: int = 0):
        self.tokenizer = _tiktoken_encoder
        self.chunker = SentenceChunker(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            tokenizer=self.tokenizer,
            delim=["."]
        )
        self.toc_pattern = re.compile(r'<span data-type="title" id="toc-(\d+)">')
        # Track chunking stats
        self.segments_under_limit = 0  # Chunks splitted by toc
        self.segments_over_limit = 0  # Chunks splitted by SentenceChunker

    def _chunk_text(self, text: str) -> List[str]:
        """Chunk text using the sentence chunker."""
        chunks = self.chunker(text)
        return [chunk.text for chunk in chunks]

    def _validate_chunk(self, text: str, max_tokens: int = MAX_CHUNK_TOKENS) -> List[str]:
        """Validate and potentially split a chunk if too large."""
        if count_tokens(text) > max_tokens:
            self.segments_over_limit += 1
            return self._chunk_text(text)
        self.segments_under_limit += 1
        return [text]

    def _process_html_segment(self, html: str) -> List[str]:
        """Process an HTML segment and return chunks."""
        text = strip_html(html)
        if text:
            return self._validate_chunk(text)
        return []

    def get_chunking_stats(self) -> Dict[str, int]:
        """Return chunking statistics."""
        return {
            "segments_under_limit": self.segments_under_limit,
            "segments_over_limit": self.segments_over_limit,
        }

    def _post_process_chunks(self, chunks: List[str]) -> List[str]:
        """Post-process chunks to handle colon endings and short chunks."""
        if not chunks:
            return chunks

        result = []
        carry_forward = ""

        for chunk in chunks:
            if carry_forward:
                chunk = carry_forward + "\n\n" + chunk
                carry_forward = ""

            before, colon_content = split_trailing_colon_content(chunk)

            if colon_content:
                if before and count_words(before) >= 7:
                    result.append(before)
                elif before:
                    carry_forward = before + "\n\n" + colon_content
                    continue
                carry_forward = colon_content
            elif count_words(chunk) < 7:
                carry_forward = chunk
            else:
                result.append(chunk)

        if carry_forward:
            if result:
                result[-1] = result[-1] + "\n\n" + carry_forward
            else:
                result.append(carry_forward)

        return result

    def chunk_book(self, metadata: Dict[str, Any], show_progress: bool = False) -> tuple:
        """
        Chunk book content based on TOC markers and semantic boundaries.

        Args:
            metadata: Book metadata containing parts, pages, and table_of_contents
            show_progress: Whether to show progress bar

        Returns:
            Tuple of (List of text chunks, chunking stats dict)
        """
        parts = metadata.get("parts", [])
        pages = metadata.get("pages", {})

        chunk_pages = []
        pending_html = ""

        iterator = tqdm(parts, desc="Chunking") if show_progress else parts

        for p in iterator:
            pages_in_part = pages.get(p, [])
            html_parts = [pending_html] if pending_html else []
            for entry in pages_in_part:
                html_parts.append(entry.get("display_elem", ""))
                html_parts.append("\n")
            full_html = "".join(html_parts)

            matches = list(self.toc_pattern.finditer(full_html))

            if not matches:
                pending_html = full_html
                continue

            split_points = []
            for match in matches:
                marker_pos = match.start()
                sentence_start = find_sentence_boundary_before(full_html, marker_pos)
                split_points.append(sentence_start)

            if split_points[0] > 0:
                seg_html = full_html[:split_points[0]]
                chunk_pages.extend(self._process_html_segment(seg_html))

            for i, start in enumerate(split_points):
                if i + 1 < len(split_points):
                    seg_html = full_html[start:split_points[i + 1]]
                    chunk_pages.extend(self._process_html_segment(seg_html))
                else:
                    pending_html = full_html[start:]

        if pending_html:
            chunk_pages.extend(self._process_html_segment(pending_html))

        result = self._post_process_chunks(chunk_pages)

        return result, self.get_chunking_stats()


class PageMatcher:
    """Matches chunks to page ranges using length-based algorithm."""

    def _load_pages_for_matching(self, metadata: Dict[str, Any], chunks: List[str]) -> List:
        """Load pages and compute their normalized text lengths for matching."""
        parts = metadata.get("parts", [])
        pages_data = metadata.get("pages", {})

        chunk_total = sum(len(clean_arabic_text(chunk)) for chunk in chunks)

        page_info = []
        for p in parts:
            if p not in pages_data:
                continue

            for entry in pages_data[p]:
                page_id = entry.get("page_id")
                page_num = entry.get("page_num")
                page_html = entry.get("display_elem", "") + "\n"

                estimated_len = len(clean_arabic_text(strip_html(page_html)))
                page_info.append((page_id, page_num, p, estimated_len))

        estimated_total = sum(p[3] for p in page_info)

        page_lengths = []
        remaining_length = chunk_total

        for i, (page_id, page_num, part, estimated_len) in enumerate(page_info):
            if i == len(page_info) - 1:
                page_lengths.append([page_id, page_num, part, remaining_length])
            else:
                if estimated_total > 0:
                    proportional_len = round(chunk_total * estimated_len / estimated_total)
                else:
                    proportional_len = 0
                page_lengths.append([page_id, page_num, part, proportional_len])
                remaining_length -= proportional_len

        return page_lengths

    def match_chunks_to_pages(
        self,
        chunks: List[str],
        metadata: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Match chunks to page ranges using length-based algorithm.

        Returns list of dicts with text, start_page_id, page_offset, page_num_range,
        part_title, and metadata.
        """
        book_id = metadata.get("book_id")
        book_name = metadata.get("book_name")
        author = metadata.get("author")
        category = metadata.get("category")

        page_texts = self._load_pages_for_matching(metadata, chunks)

        if not chunks or not page_texts:
            return [
                {
                    "text": chunk,
                    "order": i,
                    "book_id": book_id,
                    "book_name": book_name,
                    "author": author,
                    "category": category
                }
                for i, chunk in enumerate(chunks)
            ]

        chunk_lengths = []
        for chunk in chunks:
            length = len(clean_arabic_text(chunk))
            chunk_lengths.append(length)

        result = [
            {
                "text": chunk,
                "order": i,
                "book_id": book_id,
                "book_name": book_name,
                "author": author,
                "category": category
            }
            for i, chunk in enumerate(chunks)
        ]

        chunk_pointer, page_pointer = 0, 0
        start_page_index = 0
        start_page_id = page_texts[0][0]
        start_page_num = page_texts[0][1]
        curr_part = None

        chunk_lens = chunk_lengths.copy()
        page_lens = [[p[0], p[1], p[2], p[3]] for p in page_texts]

        while page_pointer < len(page_lens) and chunk_pointer < len(chunks):
            c_length = chunk_lens[chunk_pointer]
            page_id, page_num, part_title, p_length = page_lens[page_pointer]

            curr_part = part_title

            if p_length < c_length:
                page_lens[page_pointer][3] = 0
                chunk_lens[chunk_pointer] -= p_length
                page_pointer += 1
            elif p_length > c_length:
                page_offset = page_pointer - start_page_index
                result[chunk_pointer]["start_page_id"] = start_page_id
                result[chunk_pointer]["page_offset"] = page_offset
                result[chunk_pointer]["page_num_range"] = [start_page_num, page_num]
                result[chunk_pointer]["part_title"] = curr_part
                start_page_index = page_pointer
                start_page_id = page_id
                start_page_num = page_num
                chunk_lens[chunk_pointer] = 0
                page_lens[page_pointer][3] -= c_length
                chunk_pointer += 1
            else:
                page_offset = page_pointer - start_page_index
                result[chunk_pointer]["start_page_id"] = start_page_id
                result[chunk_pointer]["page_offset"] = page_offset
                result[chunk_pointer]["page_num_range"] = [start_page_num, page_num]
                result[chunk_pointer]["part_title"] = curr_part
                chunk_lens[chunk_pointer] = 0
                page_lens[page_pointer][3] = 0
                page_pointer += 1
                chunk_pointer += 1
                if page_pointer < len(page_lens):
                    start_page_index = page_pointer
                    start_page_id = page_lens[page_pointer][0]
                    start_page_num = page_lens[page_pointer][1]

        for i in range(chunk_pointer, len(chunks)):
            if "start_page_id" not in result[i]:
                if i > 0 and "start_page_id" in result[i - 1]:
                    result[i]["start_page_id"] = result[i - 1]["start_page_id"]
                    result[i]["page_offset"] = result[i - 1]["page_offset"]
                    result[i]["page_num_range"] = result[i - 1]["page_num_range"]
                    result[i]["part_title"] = result[i - 1]["part_title"]
                else:
                    result[i]["start_page_id"] = start_page_id
                    result[i]["page_offset"] = 0
                    result[i]["page_num_range"] = [start_page_num, start_page_num]
                    result[i]["part_title"] = curr_part if curr_part else ""

        return result


class EmbeddingService:
    """Service for generating embeddings using DeepInfra API."""

    API_URL = "https://api.deepinfra.com/v1/inference/BAAI/bge-m3-multi"

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def _embed_batch(
        self,
        client: httpx.AsyncClient,
        semaphore: asyncio.Semaphore,
        batch_texts: List[str],
        batch_index: int,
    ) -> List[List[float]]:
        """Embed a single batch with semaphore-controlled concurrency."""
        headers = {
            "Authorization": f"bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {"inputs": batch_texts}

        max_retries = 3
        async with semaphore:
            for attempt in range(max_retries):
                try:
                    response = await client.post(
                        self.API_URL,
                        headers=headers,
                        json=payload,
                        timeout=300,
                    )
                    response.raise_for_status()
                    data = response.json()
                    embeddings = data.get("embeddings")
                    if not embeddings:
                        raise RuntimeError(
                            f"DeepInfra API returned no embeddings for batch {batch_index}. "
                            f"Response keys: {list(data.keys())}"
                        )
                    logger.info("Batch embedded", batch=batch_index, chunks=len(batch_texts))
                    return embeddings
                except (httpx.TimeoutException, httpx.ConnectError) as e:
                    if attempt < max_retries - 1:
                        wait_time = 2 ** attempt * 5
                        logger.warning(
                            "DeepInfra API request failed, retrying",
                            batch=batch_index,
                            attempt=attempt + 1,
                            max_retries=max_retries,
                            wait_seconds=wait_time,
                            error=str(e),
                        )
                        await asyncio.sleep(wait_time)
                    else:
                        raise

    async def embed_chunks_async(
        self,
        matched_chunks: List[Dict[str, Any]],
        batch_size: int = 100,
        max_concurrent: int = 4,
        progress_callback: Optional[Callable[[int], None]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Embed chunks using concurrent async HTTP requests to DeepInfra API.

        Args:
            matched_chunks: List of chunk dicts with text and metadata
            batch_size: Batch size for API requests
            max_concurrent: Maximum number of concurrent API requests
            progress_callback: Called after each batch with total chunks embedded so far

        Returns:
            List of chunk dicts with added dense_vector
        """
        texts = [chunk["text"] for chunk in matched_chunks]
        if not texts:
            return matched_chunks

        # Build batches
        batches = []
        for i in range(0, len(texts), batch_size):
            batches.append(texts[i:i + batch_size])

        logger.info(
            "Starting async embedding",
            total_chunks=len(texts),
            batches=len(batches),
            max_concurrent=max_concurrent,
        )

        semaphore = asyncio.Semaphore(max_concurrent)
        all_dense_vectors: List[List[float]] = []
        chunks_so_far = 0

        async with httpx.AsyncClient() as client:
            tasks = [
                self._embed_batch(client, semaphore, batch, idx)
                for idx, batch in enumerate(batches)
            ]
            results = await asyncio.gather(*tasks)

        for batch_result in results:
            all_dense_vectors.extend(batch_result)
            chunks_so_far += len(batch_result)
            if progress_callback:
                progress_callback(chunks_so_far)

        for i, chunk in enumerate(matched_chunks):
            chunk["dense_vector"] = all_dense_vectors[i]

        return matched_chunks

    def embed_chunks(
        self,
        matched_chunks: List[Dict[str, Any]],
        batch_size: int = 100,
        progress_callback: Optional[Callable[[int], None]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Synchronous wrapper that runs async embed_chunks_async via asyncio.run().

        Called from worker threads so it's safe to create a new event loop.
        """
        return asyncio.run(
            self.embed_chunks_async(
                matched_chunks,
                batch_size=batch_size,
                progress_callback=progress_callback,
            )
        )


def generate_embeddings(
    metadata: Dict[str, Any],
    deepinfra_api_key: str,
    show_progress: bool = False,
    progress_callback: Optional[Callable[[str, Any], None]] = None
) -> tuple:
    """
    Generate embeddings for a book from its metadata.

    This is the main entry point for the embedding pipeline.
    Dense vectors are generated via DeepInfra API.
    Sparse vectors are generated via ArabicBM25S (fitted per-book on the chunks).

    Args:
        metadata: Book metadata containing parts, pages, table_of_contents, etc.
        deepinfra_api_key: API key for DeepInfra
        show_progress: Whether to show progress bars
        progress_callback: Called with (event, value) for progress updates

    Returns:
        Tuple of (embedded_chunks list, chunking_stats dict)
    """
    from sparse_vector_generator import ArabicBM25S

    book_id = metadata.get("book_id")
    logger.info("Starting embedding generation", book_id=book_id)

    # Step 1: Chunk the book
    chunker = BookChunker()
    chunks, chunking_stats = chunker.chunk_book(metadata, show_progress=show_progress)
    logger.info("Chunking complete", book_id=book_id, num_chunks=len(chunks))

    if progress_callback:
        progress_callback("chunking_done", len(chunks))

    # Step 2: Match chunks to pages
    matcher = PageMatcher()
    matched_chunks = matcher.match_chunks_to_pages(chunks, metadata)
    logger.info("Page matching complete", book_id=book_id)

    # Build an embedding progress callback that forwards batch counts
    embed_progress_cb = None
    if progress_callback:
        def embed_progress_cb(chunks_so_far: int):
            progress_callback("embedding_progress", chunks_so_far)

    # Step 3: Generate dense embeddings via DeepInfra API
    embedding_service = EmbeddingService(api_key=deepinfra_api_key)
    embedded_chunks = embedding_service.embed_chunks(
        matched_chunks,
        batch_size=100,
        progress_callback=embed_progress_cb,
    )
    logger.info("Dense embedding complete", book_id=book_id, num_chunks=len(embedded_chunks))

    # Step 4: Generate sparse vectors using BM25
    texts = [chunk["text"] for chunk in embedded_chunks]
    bm25 = ArabicBM25S()
    bm25.fit(texts)
    sparse_vectors = bm25.encode_documents(texts)
    for i, chunk in enumerate(embedded_chunks):
        chunk["sparse_vector"] = sparse_vectors[i].to_milvus()
    logger.info("Sparse embedding complete (BM25)", book_id=book_id, num_chunks=len(embedded_chunks))

    return embedded_chunks, chunking_stats


def embeddings_to_jsonl(embedded_chunks: List[Dict[str, Any]]) -> str:
    """
    Convert embedded chunks to JSONL format.

    Args:
        embedded_chunks: List of chunk dicts with embeddings

    Returns:
        JSONL string
    """
    lines = []
    for chunk in embedded_chunks:
        lines.append(json.dumps(chunk, ensure_ascii=False))
    return '\n'.join(lines)


def compute_embedding_stats(
    embedded_chunks: List[Dict[str, Any]],
    chunking_stats: Dict[str, int] = None
) -> Dict[str, Any]:
    """
    Compute comprehensive statistics from embedded chunks.

    Args:
        embedded_chunks: List of chunk dicts with text, metadata, page info, and embeddings
        chunking_stats: Dict with chunks_not_split and chunks_split counts from BookChunker

    Returns:
        Dictionary containing computed statistics
    """
    if not embedded_chunks:
        return {"total_chunks": 0, "segments_under_limit": 0, "segments_over_limit": 0}

    encoder = tiktoken.get_encoding(TOKENIZER_MODEL)

    # Collect metrics from each chunk
    token_counts = []
    char_counts = []
    word_counts = []
    sparse_nnz_counts = []
    page_offsets = []

    for chunk in embedded_chunks:
        text = chunk.get("text", "")

        # Token count
        tokens = len(encoder.encode(text))
        token_counts.append(tokens)

        # Character count
        char_counts.append(len(text))

        # Word count
        word_counts.append(len(text.split()))

        # Page offset
        if chunk.get("page_offset") is not None:
            page_offsets.append(chunk.get("page_offset"))

        # Sparse vector non-zero entries
        sparse_vec = chunk.get("sparse_vector", {})
        sparse_nnz_counts.append(len(sparse_vec))

    # Compute statistics
    def percentile(data: List[float], p: float) -> float:
        """Compute percentile of a sorted list."""
        if not data:
            return 0.0
        sorted_data = sorted(data)
        k = (len(sorted_data) - 1) * p / 100
        f = int(k)
        c = f + 1 if f + 1 < len(sorted_data) else f
        return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])

    def median(data: List[float]) -> float:
        return percentile(data, 50)

    def mean(data: List[float]) -> float:
        return sum(data) / len(data) if data else 0.0

    def stddev(data: List[float]) -> float:
        if len(data) < 2:
            return 0.0
        avg = mean(data)
        variance = sum((x - avg) ** 2 for x in data) / len(data)
        return variance ** 0.5

    def variance(data: List[float]) -> float:
        if len(data) < 2:
            return 0.0
        avg = mean(data)
        return sum((x - avg) ** 2 for x in data) / len(data)

    total_chunks = len(embedded_chunks)

    stats = {
        # Chunk counts
        "total_chunks": total_chunks,
        "segments_under_limit": chunking_stats.get("segments_under_limit", 0) if chunking_stats else 0,
        "segments_over_limit": chunking_stats.get("segments_over_limit", 0) if chunking_stats else 0,

        # Token statistics
        "total_tokens": sum(token_counts),
        "min_tokens": min(token_counts) if token_counts else 0,
        "max_tokens": max(token_counts) if token_counts else 0,
        "avg_tokens": round(mean(token_counts), 2),
        "median_tokens": round(median(token_counts), 2),
        "stddev_tokens": round(stddev(token_counts), 2),
        "p25_tokens": round(percentile(token_counts, 25), 2),
        "p75_tokens": round(percentile(token_counts, 75), 2),
        "p90_tokens": round(percentile(token_counts, 90), 2),
        "p95_tokens": round(percentile(token_counts, 95), 2),

        # Character statistics
        "total_characters": sum(char_counts),
        "min_characters": min(char_counts) if char_counts else 0,
        "max_characters": max(char_counts) if char_counts else 0,
        "avg_characters": round(mean(char_counts), 2),
        "median_characters": round(median(char_counts), 2),

        # Word statistics
        "total_words": sum(word_counts),
        "min_words": min(word_counts) if word_counts else 0,
        "max_words": max(word_counts) if word_counts else 0,
        "avg_words": round(mean(word_counts), 2),
        "median_words": round(median(word_counts), 2),

        # Embedding statistics
        "avg_sparse_vector_nnz": round(mean(sparse_nnz_counts), 2) if sparse_nnz_counts else 0,
        "min_sparse_vector_nnz": min(sparse_nnz_counts) if sparse_nnz_counts else 0,
        "max_sparse_vector_nnz": max(sparse_nnz_counts) if sparse_nnz_counts else 0,
        "total_sparse_entries": sum(sparse_nnz_counts),

        # Page coverage
        "min_page_offset": min(page_offsets) if page_offsets else None,
        "max_page_offset": max(page_offsets) if page_offsets else None,
        "avg_page_offset": round(mean(page_offsets), 2) if page_offsets else None,

        # Content analysis
        "avg_chunk_length_chars": round(mean(char_counts), 2),
        "chunk_length_variance": round(variance(char_counts), 2),
    }

    logger.info(
        "Computed embedding stats",
        total_chunks=total_chunks,
        avg_tokens=stats["avg_tokens"],
        max_tokens=stats["max_tokens"]
    )

    return stats
