import asyncio
import logging
import os
import sys
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from typing import List, Optional

import httpx
import structlog
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from models import (
    GatewayRequest,
    GatewayResponse,
    HealthResponse,
    ErrorResponse,
)

# Load environment variables
load_dotenv()


# Configuration
class Config:
    QUERY_OPTIMIZER_URL = os.getenv("QUERY_OPTIMIZER_URL", "http://localhost:5000")
    EMBED_SERVICE_URL = os.getenv("EMBED_SERVICE_URL", "http://localhost:4000")
    SEARCH_SERVICE_URL = os.getenv("SEARCH_SERVICE_URL", "http://localhost:3000")
    ASK_SERVICE_URL = os.getenv("ASK_SERVICE_URL", "http://localhost:2000")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "120"))

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        required = [
            cls.QUERY_OPTIMIZER_URL,
            cls.EMBED_SERVICE_URL,
            cls.SEARCH_SERVICE_URL,
            cls.ASK_SERVICE_URL,
        ]
        if not all(required):
            raise ValueError("All service URLs must be configured")


# Logging setup
def setup_logging():
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, Config.LOG_LEVEL),
    )


# Global variables
http_client: Optional[httpx.AsyncClient] = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global http_client

    # Startup
    try:
        logger.info("Starting Gateway Service")
        Config.validate()

        # Initialize HTTP client
        timeout = httpx.Timeout(Config.REQUEST_TIMEOUT)
        http_client = httpx.AsyncClient(timeout=timeout)

        logger.info("Service started successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Gateway Service")
        if http_client:
            await http_client.aclose()
        http_client = None


# FastAPI app
app = FastAPI(
    title="RAG Gateway API",
    description="Gateway service orchestrating the complete RAG pipeline",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        os.getenv("ALLOWED_ORIGINS", "").split(",")
        if os.getenv("ALLOWED_ORIGINS")
        else ["*"]
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    """Request/response logging and timing"""
    request_id = request.headers.get("x-request-id", f"req_{int(time.time() * 1000)}")
    start_time = time.time()

    logger.info(
        "Request started",
        method=request.method,
        path=request.url.path,
        request_id=request_id,
    )

    response = await call_next(request)

    duration = time.time() - start_time
    logger.info(
        "Request completed",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration=f"{duration:.3f}s",
        request_id=request_id,
    )

    response.headers["x-request-id"] = request_id
    return response


# Error handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    request_id = request.headers.get("x-request-id", "unknown")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorResponse(
            error=str(exc),
            request_id=request_id,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        ).model_dump(),
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id", "unknown")
    logger.error("Unhandled exception", error=str(exc), request_id=request_id)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse(
            error="Internal server error",
            request_id=request_id,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        ).model_dump(),
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
    )


@app.get("/ready", response_model=HealthResponse)
async def readiness_check():
    """Readiness check endpoint"""
    try:
        if http_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service not ready - HTTP client not initialized",
            )

        return HealthResponse(
            status="ready",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        )
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}",
        )


def aggregate_results_rrf(
    keyword_results: List[list], top_k: int, k: int = 60
) -> list:
    """
    Aggregate results from multiple keyword searches using Reciprocal Rank Fusion.

    For each document, compute: score = sum(1 / (k + rank_i)) across all keyword
    queries where it appears. Documents appearing in more keyword results with
    higher ranks get boosted to the top.

    Args:
        keyword_results: List of result lists, one per keyword search.
        top_k: Number of top results to return.
        k: RRF smoothing constant (default 60).

    Returns:
        Deduplicated, RRF-ranked list of top_k results.
    """
    doc_scores = defaultdict(float)
    doc_data = {}

    for ranked_list in keyword_results:
        for rank, doc in enumerate(ranked_list):
            doc_id = doc["id"]
            doc_scores[doc_id] += 1.0 / (k + rank + 1)
            # Keep the doc data from whichever occurrence had the best
            # individual distance (lowest = most similar)
            if doc_id not in doc_data or doc["distance"] < doc_data[doc_id]["distance"]:
                doc_data[doc_id] = doc

    # Sort by RRF score descending
    sorted_ids = sorted(doc_scores, key=lambda did: doc_scores[did], reverse=True)

    results = []
    for doc_id in sorted_ids[:top_k]:
        entry = doc_data[doc_id]
        entry["distance"] = doc_scores[doc_id]
        results.append(entry)

    return results


# Main RAG Pipeline Orchestration
@app.post(
    "/query",
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
    },
)
async def process_query(request: GatewayRequest, http_request: Request):
    """
    Orchestrate the complete RAG pipeline with keyword fan-out search:
    1. Extract keywords using query-optimizer-service
    2. Embed all keywords in batch using embed-service
    3. Fan-out search: one search per keyword, aggregate with cross-query RRF
    4. Generate response using ask-service

    **Request Parameters:**
    - query: User's search query
    - top_k: Number of search results to retrieve (default: 15)
    - temperature: Temperature for response generation (default: 0.2)
    - max_tokens: Maximum tokens in response (default: 8000)
    - stream: Enable streaming response (default: false)
    - reranker: Reranking strategy - "RRF" or "Weighted" (default: "Weighted")
    - reranker_params: Parameters for reranker
      - RRF: single int in (0, 16384], e.g., [60]
      - Weighted: two floats in [0, 1], e.g., [0.5, 0.5] or [1.0, 1.0]

    **Non-Streaming Response (stream=false):**
    Returns a JSON object with complete response, sources, and keywords.

    **Streaming Response (stream=true):**
    Returns newline-delimited JSON (NDJSON) chunks in this order:
    1. Metadata chunk: {"type": "metadata", "sources": [...], "keywords": [...], "request_id": "..."}
    2. Content chunks: {"type": "content", "delta": "text piece"}
    3. Done chunk: {"type": "done"}

    Each chunk is a complete JSON object followed by a newline character.
    The client should parse each line as separate JSON.
    """
    request_id = http_request.headers.get(
        "x-request-id", f"req_{int(time.time() * 1000)}"
    )

    try:
        if http_client is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Service unavailable - HTTP client not initialized",
            )

        logger.info(
            "Starting RAG pipeline",
            query=request.query,
            stream=request.stream,
            reranker=request.reranker,
            reranker_params=request.reranker_params,
            request_id=request_id,
        )

        # Step 1: Extract keywords via query optimizer
        logger.info("Step 1: Extracting keywords", request_id=request_id)
        optimize_response = await http_client.post(
            f"{Config.QUERY_OPTIMIZER_URL}/optimize-queries",
            json={"queries": [request.query]},
            headers={"x-request-id": request_id},
        )
        optimize_response.raise_for_status()
        optimize_data = optimize_response.json()

        # Extract hypothetical passages, keywords, and categories
        first_result = optimize_data["results"][0] if optimize_data["results"] else {}
        hypothetical_passages = first_result.get("hypothetical_passages", [request.query])
        keywords = first_result.get("keywords", [request.query])
        categories = first_result.get("categories", [])

        # Build Milvus filter expression from categories
        category_filter = ""
        if categories:
            escaped = [cat.replace('"', '\\"') for cat in categories]
            category_filter = 'category in [' + ', '.join(f'"{c}"' for c in escaped) + ']'
        logger.info(
            "Query optimized",
            passage_count=len(hypothetical_passages),
            keywords=keywords,
            keywords_count=len(keywords),
            categories=categories,
            category_filter=category_filter,
            request_id=request_id,
        )

        # Step 2: Embed hypothetical passages (dense + sparse)
        logger.info(
            "Step 2: Embedding passages",
            passage_count=len(hypothetical_passages),
            request_id=request_id,
        )
        embed_response = await http_client.post(
            f"{Config.EMBED_SERVICE_URL}/embed",
            json={
                "input_text": hypothetical_passages,
                "dense": True,
                "sparse": True,
                "colbert": False,
            },
            headers={"x-request-id": request_id},
        )
        embed_response.raise_for_status()
        embed_data = embed_response.json()

        logger.info(
            "Embeddings generated",
            dense_count=len(embed_data["dense"]),
            sparse_count=len(embed_data["sparse"]),
            request_id=request_id,
        )

        # Step 3: Fan-out search — one request per keyword for per-keyword ranking
        logger.info("Step 3: Fan-out search across keywords", request_id=request_id)

        base_search_payload = {
            "k": request.top_k,
            "reranker": request.reranker,
            "reranker_params": request.reranker_params,
            "collection_name": "islamic_library",
            "partition_names": [],
            "output_fields": [
                "id",
                "book_id",
                "book_name",
                "order",
                "author",
                "category",
                "part_title",
                "start_page_id",
                "page_offset",
                "page_num_range",
                "text",
            ],
        }
        if category_filter:
            base_search_payload["filter"] = category_filter

        # Fire parallel search requests: one hybrid search per hypothetical passage
        async def search_passage(idx):
            payload = {
                **base_search_payload,
                "embeddings": [
                    {
                        "dense": embed_data["dense"][idx],
                        "sparse": embed_data["sparse"][idx],
                        "dense_params": {"n_probe": 10},
                        "sparse_params": {"drop_ratio_search": 0.2},
                    }
                ],
            }
            resp = await http_client.post(
                f"{Config.SEARCH_SERVICE_URL}/search",
                json=payload,
                headers={"x-request-id": request_id},
            )
            resp.raise_for_status()
            return resp.json()["results"]

        all_results = await asyncio.gather(
            *[search_passage(i) for i in range(len(hypothetical_passages))],
        )

        # Step 3.5: Aggregate with cross-query RRF
        sources = aggregate_results_rrf(all_results, top_k=request.top_k)
        logger.info(
            "Search completed",
            sources_count=len(sources),
            passage_searches=len(hypothetical_passages),
            request_id=request_id,
        )

        # Step 4: Generate response using ask-service
        logger.info("Step 4: Generating response", request_id=request_id)

        ask_payload = {
            "query": request.query,
            "sources": sources,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": request.stream,
        }

        if request.stream:
            # Stream response with metadata
            async def stream_generator():
                import json

                # First chunk: Send metadata (sources, keywords)
                metadata_chunk = {
                    "type": "metadata",
                    "sources": sources,
                    "hypothetical_passages": hypothetical_passages,
                    "keywords": keywords,
                    "request_id": request_id
                }
                yield json.dumps(metadata_chunk) + "\n"

                # Stream content chunks from ask-service
                async with http_client.stream(
                    "POST",
                    f"{Config.ASK_SERVICE_URL}/ask",
                    json=ask_payload,
                    headers={"x-request-id": request_id},
                ) as response:
                    response.raise_for_status()
                    async for chunk in response.aiter_text():
                        if chunk:
                            content_chunk = {
                                "type": "content",
                                "delta": chunk
                            }
                            yield json.dumps(content_chunk) + "\n"

                # Final chunk: Signal completion
                done_chunk = {"type": "done"}
                yield json.dumps(done_chunk) + "\n"

            return StreamingResponse(
                stream_generator(),
                media_type="application/x-ndjson",
                headers={"x-request-id": request_id},
            )
        else:
            # Non-streaming response
            ask_response = await http_client.post(
                f"{Config.ASK_SERVICE_URL}/ask",
                json=ask_payload,
                headers={"x-request-id": request_id},
            )
            ask_response.raise_for_status()
            ask_data = ask_response.json()

            logger.info(
                "RAG pipeline completed",
                request_id=request_id,
            )

            return GatewayResponse(
                response=ask_data["response"],
                sources=sources,
                hypothetical_passages=hypothetical_passages,
                keywords=keywords,
                request_id=request_id,
            )

    except httpx.HTTPStatusError as e:
        logger.error(
            "Service request failed",
            error=str(e),
            status_code=e.response.status_code,
            request_id=request_id,
        )
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Service request failed: {e.response.text}",
        )
    except httpx.TimeoutException:
        logger.error("Request timeout", request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request timed out",
        )
    except Exception as e:
        logger.error("Pipeline execution failed", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process query: {str(e)}",
        )


if __name__ == "__main__":
    setup_logging()
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_config=None,
        access_log=False,
    )
