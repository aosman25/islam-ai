import os
from dotenv import load_dotenv
import csv

from pinecone.grpc import PineconeGRPC as Pinecone
from pinecone import ServerlessSpec

csv.field_size_limit(10**9)

# Load environment variables from .env file
load_dotenv()

# Retrieve API keys and environment from environment variables
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)
# Define your query
query1 = "اين الله"
query2 = "من هو الله"

# Convert the query into a numerical vector that Pinecone can search with
query_embedding = pc.inference.embed(
    model="multilingual-e5-large",
    inputs=[query1],
    parameters={
        "input_type": "query"
    }
)


print(query_embedding[0].values)