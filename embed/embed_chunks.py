import os
from dotenv import load_dotenv
import csv
import time
import uuid
from pinecone.grpc import PineconeGRPC as Pinecone
from pinecone import ServerlessSpec

csv.field_size_limit(10**9)

# Load environment variables from .env file
load_dotenv()

# Retrieve API keys and environment from environment variables
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)

def read_csv_as_dicts(file_path):
    rows_as_dicts = []
    with open(file_path, mode='r', encoding='utf-8') as csv_file:
        csv_reader = csv.DictReader(csv_file)  # Automatically uses first row as keys
        for row in csv_reader:
            row_dict = dict(row)  # Convert OrderedDict to regular dict for convenience
            row_dict['id'] = str(uuid.uuid4())  # Generate a unique UUID and convert it to string
            rows_as_dicts.append(row_dict)
    return rows_as_dicts

# Load CSV file
csv_path = "../data_chunks_csv/العقيدة.csv"  # Update this path to your actual CSV file
print("Reading CSV file...")
data = read_csv_as_dicts(csv_path)

# Create a serverless index
index_name = "islamic-text-embedding"

if not pc.has_index(index_name):
    pc.create_index(
        name=index_name,
        dimension=1024,
        metric="cosine",
        spec=ServerlessSpec(
            cloud='aws', 
            region='us-east-1'
        ) 
    ) 

# Wait for the index to be ready
while not pc.describe_index(index_name).status['ready']:
    time.sleep(1)

# Target the index where you'll store the vector embeddings
index = pc.Index(index_name)

# Define batch size
batch_size = 10
num_batches = (len(data) + batch_size - 1) // batch_size  # Calculate number of batches

# Process each batch
for i in range(num_batches):
    print(f"Processing batch {i + 1} of {num_batches}...")
    
    # Get the current batch
    current_batch = data[i * batch_size:(i + 1) * batch_size]
    
    # Create embeddings for the current batch
    embeddings = pc.inference.embed(
        model="multilingual-e5-large",
        inputs=[item["Chunk"] for item in current_batch],
        parameters={"input_type": "passage", "truncate": "END"}
    )
    
    # Prepare the records for upsert
    records = []
    print('Creating records for current batch...')
    for d, e in zip(current_batch, embeddings):
        # Ensure metadata is not exceeding size limit
        metadata = {
            'knowledge': d['Knowledge'][:50],  # Truncate if necessary
            'category': d['Category'],
            'book_name': d['Book Name'][:50],  # Truncate if necessary
            "chunk": d['Chunk'] # Truncate if necessary
        }
        records.append({
            "id": d['id'],
            "values": e['values'],
            "metadata": metadata
        })

    # Upsert the records into the index
    print("Upserting the records into the index...")
    index.upsert(
        vectors=records,
        namespace="aqeedah"  # ASCII-only namespace
    )

    print(f"Successfully upserted batch {i + 1} of {num_batches}.")

print("All records successfully upserted into the index.")
