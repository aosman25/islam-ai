
import logging
from pymilvus import (
    MilvusClient,
    DataType,
)
import json

# Configure logging
logging.basicConfig(level=logging.INFO)

DATATYPE_MAP = {
    "VARCHAR": DataType.VARCHAR,
    "INT32": DataType.INT32,
    "ARRAY": DataType.ARRAY,
    "FLOAT_VECTOR": DataType.FLOAT_VECTOR,
    "SPARSE_FLOAT_VECTOR": DataType.SPARSE_FLOAT_VECTOR,
}

def create_library_schema(client,json_path="library_schema_fields.json"):
    schema = MilvusClient.create_schema(auto_id=False, enable_dyanmic_field=True)

    with open(json_path, "r", encoding="utf-8") as f:
        fields = json.load(f)

    for field in fields:
        field = field.copy()
        field["datatype"] = DATATYPE_MAP[field["datatype"]]
        if "element_type" in field:
            field["element_type"] = DATATYPE_MAP[field["element_type"]]
        schema.add_field(**field)

    return schema

def create_library_index_params(client,json_path="library_index_params.json"):
    index_params = client.prepare_index_params()

    with open(json_path, "r", encoding="utf-8") as f:
        index_defs = json.load(f)

    for index in index_defs:
        index_params.add_index(**index)

    return index_params


def create_library_collection(client, collection_name):
    if not client.has_collection(collection_name=collection_name):
        logging.info(f"Creating {collection_name} Collection...")
        client.create_collection(
            collection_name=collection_name,
            schema=create_library_schema(client),
            index_params=create_library_index_params(client),
        )
        logging.info("Successfully created {collection_name} Collection!")
    else:
        logging.info("Collection already exists.")
