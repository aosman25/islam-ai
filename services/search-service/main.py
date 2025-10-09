import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List, Literal, Union

import structlog
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator
from pymilvus import MilvusClient, RRFRanker, WeightedRanker, AnnSearchRequest
from dotenv import load_dotenv

# Import .env file
load_dotenv()


# Configuration
class Config:
    MILVUS_IP_ADDRESS = os.getenv("MILVUS_IP_ADDRESS")
    MILVUS_TOKEN = os.getenv("MILVUS_TOKEN")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    MAX_EMBEDDINGS_PER_REQUEST = int(os.getenv("MAX_EMBEDDINGS_PER_REQUEST", "10"))
    MAX_SEARCH_K = int(os.getenv("MAX_SEARCH_K", "100"))
    REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "60"))

    @classmethod
    def validate(cls):
        """Validate required configuration"""
        if not cls.MILVUS_IP_ADDRESS:
            raise ValueError("MILVUS_IP_ADDRESS environment variable is required")
        if not cls.MILVUS_TOKEN:
            raise ValueError("MILVUS_TOKEN environment variable is required")


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


# Models
class DenseVectorParams(BaseModel):
    n_probe: int = 10


class SparseVectorParams(BaseModel):
    drop_ratio_search: float = 0.2


class EmbeddingObject(BaseModel):
    dense: List[float]
    sparse: dict[int, float]
    dense_params: DenseVectorParams
    sparse_params: SparseVectorParams


class SearchRequest(BaseModel):
    k: int = Field(default=15, gt=0, le=Config.MAX_SEARCH_K)
    embeddings: List[EmbeddingObject] = Field(
        ..., min_items=1, max_items=Config.MAX_EMBEDDINGS_PER_REQUEST
    )
    reranker: Literal["RRF", "Weighted"] = "Weighted"
    reranker_params: List[Union[int, float]] = [1, 1]
    collection_name: str = "islamic_library"
    partition_names: List[str] = []
    output_fields: List[str] = [
        "id",
        "book_id",
        "book_name",
        "order",
        "author",
        "knowledge",
        "category",
        "header_titles",
        "page_range",
        "text",
    ]

    @model_validator(mode="after")
    def validate_reranker_params(self):
        if self.reranker == "RRF":
            if not (
                len(self.reranker_params) == 1
                and isinstance(self.reranker_params[0], int)
                and 0 < self.reranker_params[0] < 16384
            ):
                raise ValueError(
                    "RRF requires a single integer parameter in the range (0, 16384)"
                )
        elif self.reranker == "Weighted":
            if not (
                len(self.reranker_params) == 2
                and all(
                    isinstance(p, (int, float)) and 0.0 <= p <= 1.0
                    for p in self.reranker_params
                )
            ):
                raise ValueError(
                    "Weighted requires two float parameters in the range [0, 1]"
                )
        else:
            raise ValueError("The reranker must be either 'RRF' or 'Weighted'")

        available_partitions = set(["_default", "_iqeedah"])
        for p in self.partition_names:
            if p not in available_partitions:
                raise ValueError(
                    f"The partition names must be within list: {', '.join(list(available_partitions))}"
                )

        available_fields = set(
            [
                "id",
                "book_id",
                "book_name",
                "order",
                "author",
                "knowledge",
                "category",
                "header_titles",
                "page_range",
                "text",
            ]
        )
        for f in self.output_fields:
            if f not in available_fields:
                raise ValueError(
                    f"The output fields must be within list: {', '.join(list(available_fields))}"
                )

        return self


class SearchResponse(BaseModel):
    distance: float
    id: str
    book_id: str
    book_name: str
    order: int
    author: str
    knowledge: str
    category: str
    header_titles: List[str]
    page_range: List[int]
    text: str


class SearchBatchResponse(BaseModel):
    results: List[SearchResponse]
    processed_count: int
    request_id: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"


class ErrorResponse(BaseModel):
    error: str
    request_id: str
    timestamp: str


# Global variables
milvus_client = None
logger = structlog.get_logger()


# Application lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global milvus_client

    # Startup
    try:
        logger.info("Starting Search Service")
        Config.validate()

        # Note: Milvus client is initialized lazily on first request
        # to avoid blocking startup when Milvus is temporarily unavailable
        logger.info("Service started successfully")
        yield

    except Exception as e:
        logger.error("Failed to start service", error=str(e))
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Search Service")
        if milvus_client:
            try:
                milvus_client.close()
            except Exception as e:
                logger.warning("Error closing Milvus client", error=str(e))
        milvus_client = None


def get_milvus_client():
    """Get or initialize Milvus client (lazy initialization)"""
    global milvus_client
    if milvus_client is None:
        logger.info("Initializing Milvus client")
        milvus_client = MilvusClient(
            uri=f"http://{Config.MILVUS_IP_ADDRESS}:19530",
            token=Config.MILVUS_TOKEN
        )
        logger.info("Milvus client initialized successfully")
    return milvus_client


# FastAPI app
app = FastAPI(
    title="Search API",
    description="Production-ready API for hybrid search using Milvus",
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
        else []
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


# Search logic
async def process_embedding(
    request: SearchRequest, embed: EmbeddingObject, reranker, k: int, request_id: str
):
    """Process a single embedding with hybrid search"""
    try:
        search_param_1 = {
            "data": [embed.dense],
            "anns_field": "dense_vector",
            "param": embed.dense_params.model_dump(),
            "limit": k,
        }
        search_param_2 = {
            "data": [embed.sparse],
            "anns_field": "sparse_vector",
            "param": embed.sparse_params.model_dump(),
            "limit": k,
        }

        reqs = [AnnSearchRequest(**search_param_1), AnnSearchRequest(**search_param_2)]

        def hybrid_search_thread():
            return milvus_client.hybrid_search(
                collection_name=request.collection_name,
                reqs=reqs,
                ranker=reranker,
                output_fields=request.output_fields,
                limit=k,
                partition_names=request.partition_names,
            )

        results = await asyncio.to_thread(hybrid_search_thread)

        hits = []
        for hs in results:
            for h in hs:
                hits.append({"distance": h["distance"], **h["entity"]})

        logger.info(
            "Embedding processed",
            hits_count=len(hits),
            request_id=request_id,
        )
        return hits

    except Exception as e:
        logger.error(
            "Embedding processing failed",
            error=str(e),
            request_id=request_id,
        )
        raise


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
        # Try to initialize or get Milvus client
        client = get_milvus_client()

        # Test connection with a simple operation
        await asyncio.to_thread(client.list_collections)

        return HealthResponse(
            status="ready",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        )
    except Exception as e:
        logger.error("Readiness check failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Service not ready: {str(e)}"
        )


# Main endpoint
@app.post(
    "/search",
    response_model=SearchBatchResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid input"},
        500: {"model": ErrorResponse, "description": "Internal server error"},
        503: {"model": ErrorResponse, "description": "Service unavailable"},
    },
)
async def search(request: SearchRequest, http_request: Request):
    """
    Perform hybrid search on Milvus using dense and sparse vectors.

    Processes multiple embeddings in parallel with proper error handling
    and returns ranked results.
    """
    request_id = http_request.headers.get(
        "x-request-id", f"req_{int(time.time() * 1000)}"
    )

    try:
        # Get or initialize Milvus client
        get_milvus_client()

        logger.info(
            "Processing search request",
            embedding_count=len(request.embeddings),
            k=request.k,
            reranker=request.reranker,
            collection=request.collection_name,
            request_id=request_id,
        )

        # Prepare reranker once
        if request.reranker == "RRF":
            ranker = RRFRanker(*request.reranker_params)
        else:
            ranker = WeightedRanker(*request.reranker_params)

        # Parallel processing of all embeddings
        tasks = [
            process_embedding(request, embed, ranker, request.k, request_id)
            for embed in request.embeddings
        ]
        all_results = await asyncio.gather(*tasks)

        # Flatten list of lists
        flat_hits = [item for sublist in all_results for item in sublist]

        logger.info(
            "Search request completed",
            total_hits=len(flat_hits),
            request_id=request_id,
        )

        return SearchBatchResponse(
            results=flat_hits,
            processed_count=len(flat_hits),
            request_id=request_id,
        )

    except ValueError as ve:
        logger.error("Validation error", error=str(ve), request_id=request_id)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        logger.error("Search request failed", error=str(e), request_id=request_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process search request",
        )


if __name__ == "__main__":
    setup_logging()
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=3000,
        log_config=None,  # Use our custom logging
        access_log=False,  # Handled by middleware
    )
