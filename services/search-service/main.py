import asyncio
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import List

import structlog
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymilvus import MilvusClient, RRFRanker, WeightedRanker, AnnSearchRequest
from dotenv import load_dotenv
from models import (
    DenseVectorParams,
    SparseVectorParams,
    EmbeddingObject,
    SearchRequest,
    SearchResponse,
    SearchBatchResponse,
    HealthResponse,
    PartitionsResponse,
    ErrorResponse,
)

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


async def get_available_partitions(collection_name: str = "islamic_library") -> List[str]:
    """Fetch available partitions from Milvus for the given collection"""
    try:
        client = get_milvus_client()
        partitions = await asyncio.to_thread(client.list_partitions, collection_name)
        return partitions
    except Exception as e:
        logger.error("Failed to fetch partitions", error=str(e), collection=collection_name)
        # Return default partitions as fallback
        return ["_default"]


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


@app.get("/partitions", response_model=PartitionsResponse)
async def get_partitions(collection_name: str = "islamic_library"):
    """
    Get available partitions for a collection.

    This endpoint fetches the list of partitions from Milvus for the specified collection.
    Use this to discover valid partition names for search requests.
    """
    try:
        partitions = await get_available_partitions(collection_name)

        logger.info(
            "Partitions fetched successfully",
            collection=collection_name,
            partition_count=len(partitions)
        )

        return PartitionsResponse(
            collection_name=collection_name,
            partitions=partitions,
            count=len(partitions),
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
        )
    except Exception as e:
        logger.error("Failed to fetch partitions", error=str(e), collection=collection_name)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch partitions: {str(e)}"
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

        # Validate partition names dynamically
        if request.partition_names:
            available_partitions = await get_available_partitions(request.collection_name)
            invalid_partitions = [p for p in request.partition_names if p not in available_partitions]
            if invalid_partitions:
                raise ValueError(
                    f"Invalid partition names: {', '.join(invalid_partitions)}. "
                    f"Available partitions: {', '.join(available_partitions)}"
                )

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
