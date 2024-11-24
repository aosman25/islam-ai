from dotenv import load_dotenv
import os
import chromadb
from chromadb.config import Settings


# Load variables from .env file
load_dotenv()


# Create a Chroma client with the service URL and API token
import chromadb
from chromadb.config import Settings

# Create a Chroma client with the service URL and API token
client = chromadb.HttpClient(
    host=os.getenv("CHROMA_URL"),
    port=443,
    ssl=True,
    settings=Settings(
        chroma_client_auth_provider="chromadb.auth.token_authn.TokenAuthClientProvider",
        chroma_client_auth_credentials=os.getenv("CHROMA_API_KEY"),
        anonymized_telemetry=False,
    ),
)

print(client.heartbeat())
