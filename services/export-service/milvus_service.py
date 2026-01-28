"""Milvus service for upserting embedded chunks to the vector database."""

import json
from typing import Dict, List, Any, Optional

from pymilvus import MilvusClient, DataType
import structlog

logger = structlog.get_logger()

# Maximum text length for Milvus VARCHAR field
MAX_TEXT_LENGTH = 65535

# Datatype mapping for schema creation
DATATYPE_MAP = {
    "VARCHAR": DataType.VARCHAR,
    "INT32": DataType.INT32,
    "INT64": DataType.INT64,
    "ARRAY": DataType.ARRAY,
    "FLOAT_VECTOR": DataType.FLOAT_VECTOR,
    "SPARSE_FLOAT_VECTOR": DataType.SPARSE_FLOAT_VECTOR,
}


class MilvusService:
    """Service for managing Milvus vector database operations."""

    def __init__(
        self,
        uri: str,
        token: Optional[str] = None,
        collection_name: str = "islamic_library",
        schema_path: str = "library_schema_fields.json",
        index_params_path: str = "library_index_params.json"
    ):
        """
        Initialize the Milvus service.

        Args:
            uri: Milvus server URI (e.g., "http://localhost:19530")
            token: Authentication token (optional)
            collection_name: Name of the collection to use
            schema_path: Path to the schema JSON file
            index_params_path: Path to the index params JSON file
        """
        self.uri = uri
        self.token = token
        self.collection_name = collection_name
        self.schema_path = schema_path
        self.index_params_path = index_params_path
        self.client: Optional[MilvusClient] = None

    def connect(self) -> None:
        """Connect to the Milvus server."""
        logger.info("Connecting to Milvus...", uri=self.uri)
        if self.token:
            self.client = MilvusClient(uri=self.uri, token=self.token)
        else:
            self.client = MilvusClient(uri=self.uri)
        logger.info("Connected to Milvus successfully")

    def _create_schema(self) -> Any:
        """Create the collection schema from JSON file."""
        schema = MilvusClient.create_schema(auto_id=False, enable_dyanmic_field=True)

        with open(self.schema_path, "r", encoding="utf-8") as f:
            fields = json.load(f)

        for field in fields:
            field = field.copy()
            # Remove auto_id from field dict as it's handled at schema level
            field.pop("auto_id", None)
            field["datatype"] = DATATYPE_MAP[field["datatype"]]
            if "element_type" in field:
                field["element_type"] = DATATYPE_MAP[field["element_type"]]
            schema.add_field(**field)

        return schema

    def _create_index_params(self) -> Any:
        """Create index parameters from JSON file."""
        index_params = self.client.prepare_index_params()

        with open(self.index_params_path, "r", encoding="utf-8") as f:
            index_defs = json.load(f)

        for index in index_defs:
            index_params.add_index(**index)

        return index_params

    def ensure_collection_exists(self) -> None:
        """Ensure the collection exists, creating it if necessary."""
        if not self.client:
            raise RuntimeError("Not connected to Milvus. Call connect() first.")

        if not self.client.has_collection(collection_name=self.collection_name):
            logger.info("Creating collection...", collection_name=self.collection_name)
            self.client.create_collection(
                collection_name=self.collection_name,
                schema=self._create_schema(),
                index_params=self._create_index_params(),
            )
            logger.info("Collection created successfully", collection_name=self.collection_name)
        else:
            logger.debug("Collection already exists", collection_name=self.collection_name)

    def ensure_partition_exists(self, partition_name: str) -> None:
        """Ensure a partition exists, creating it if necessary."""
        if not self.client:
            raise RuntimeError("Not connected to Milvus. Call connect() first.")

        existing_partitions = set(self.client.list_partitions(self.collection_name))
        if partition_name not in existing_partitions:
            logger.info("Creating partition...", partition_name=partition_name)
            self.client.create_partition(
                collection_name=self.collection_name,
                partition_name=partition_name
            )
            logger.info("Partition created successfully", partition_name=partition_name)

    def _generate_chunk_id(self, book_id: int, order: int) -> int:
        """
        Generate a unique ID for a chunk based on book_id and order.

        Uses formula: book_id * 10_000_000 + order
        This allows up to 10 million chunks per book.
        """
        return book_id * 10_000_000 + order

    def _prepare_record(self, chunk: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare a chunk record for Milvus upsert.

        Args:
            chunk: Embedded chunk with text, metadata, and vectors

        Returns:
            Record formatted for Milvus upsert
        """
        text = chunk.get("text", "")
        if isinstance(text, str) and len(text) > MAX_TEXT_LENGTH:
            text = text[:MAX_TEXT_LENGTH]

        book_id = chunk.get("book_id", 0)
        order = chunk.get("order", 0)

        return {
            "id": self._generate_chunk_id(book_id, order),
            "book_id": book_id,
            "book_name": chunk.get("book_name", ""),
            "order": order,
            "author": chunk.get("author", ""),
            "category": chunk.get("category", ""),
            "part_title": chunk.get("part_title", ""),
            "start_page_id": chunk.get("start_page_id", 0),
            "page_offset": chunk.get("page_offset", 0),
            "page_num_range": chunk.get("page_num_range", [0, 0]),
            "text": text,
            "dense_vector": chunk.get("dense_vector", []),
            "sparse_vector": chunk.get("sparse_vector", {}),
        }

    def upsert_chunks(
        self,
        embedded_chunks: List[Dict[str, Any]],
        partition_name: str = "_default",
        batch_size: int = 12000
    ) -> int:
        """
        Upsert embedded chunks to Milvus.

        Args:
            embedded_chunks: List of chunks with embeddings
            partition_name: Partition to upsert into
            batch_size: Number of records per batch

        Returns:
            Total number of records upserted

        Raises:
            RuntimeError: If not connected or upsert fails
        """
        if not self.client:
            raise RuntimeError("Not connected to Milvus. Call connect() first.")

        if not embedded_chunks:
            logger.warning("No chunks to upsert")
            return 0

        self.ensure_collection_exists()
        self.ensure_partition_exists(partition_name)

        book_id = embedded_chunks[0].get("book_id") if embedded_chunks else "unknown"
        logger.info(
            "Starting Milvus upsert",
            book_id=book_id,
            total_chunks=len(embedded_chunks),
            partition=partition_name
        )

        total_upserted = 0
        batch = []

        for chunk in embedded_chunks:
            record = self._prepare_record(chunk)
            batch.append(record)

            if len(batch) >= batch_size:
                self.client.upsert(
                    collection_name=self.collection_name,
                    partition_name=partition_name,
                    data=batch
                )
                total_upserted += len(batch)
                logger.debug(
                    "Upserted batch",
                    book_id=book_id,
                    batch_size=len(batch),
                    total_so_far=total_upserted
                )
                batch = []

        # Upsert remaining records
        if batch:
            self.client.upsert(
                collection_name=self.collection_name,
                partition_name=partition_name,
                data=batch
            )
            total_upserted += len(batch)

        logger.info(
            "Milvus upsert completed",
            book_id=book_id,
            total_upserted=total_upserted
        )

        return total_upserted

    def delete_by_book_id(self, book_id: int, partition_name: str = "_default") -> bool:
        """
        Delete all chunks for a specific book from Milvus.

        Args:
            book_id: The book ID to delete
            partition_name: Partition to delete from

        Returns:
            True if deletion was attempted, False if not connected
        """
        if not self.client:
            raise RuntimeError("Not connected to Milvus. Call connect() first.")

        if not self.client.has_collection(collection_name=self.collection_name):
            logger.debug("Collection does not exist, nothing to delete", book_id=book_id)
            return False

        try:
            # Delete using filter expression
            self.client.delete(
                collection_name=self.collection_name,
                partition_name=partition_name,
                filter=f"book_id == {book_id}"
            )
            logger.info("Deleted book chunks from Milvus", book_id=book_id, partition=partition_name)
            return True
        except Exception as e:
            logger.warning("Failed to delete book from Milvus", book_id=book_id, error=str(e))
            return False

    def is_connected(self) -> bool:
        """Check if connected to Milvus."""
        return self.client is not None
