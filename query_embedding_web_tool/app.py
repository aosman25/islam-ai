from flask import Flask, render_template, request
from pymilvus import model
import os
from dotenv import load_dotenv
from rank_bm25 import BM25Okapi
from typing import List, Dict
import numpy as np
import json

# Load Environment Variables
load_dotenv()

app = Flask(__name__)

openai_ef = model.dense.OpenAIEmbeddingFunction(
    model_name="text-embedding-3-small",
    api_key=os.getenv("OPEN_AI_API_KEY"),
    dimensions=1536,
)


def embed_query(queries):
    query_embeddings = openai_ef.encode_queries(queries)
    # Convert numpy arrays to lists
    return [embedding.tolist() for embedding in query_embeddings]


def generate_sparse_vector(dense_vector):
    return {key: round(value, 4) for key, value in enumerate(dense_vector) if value > 0}


def create_sparse_vector(dense_embeddings: List[List[float]]) -> List[Dict]:
    results = []

    for dense_embedding in dense_embeddings:
        # Generate sparse representation directly from dense embedding
        sparse_dict = generate_sparse_vector(dense_embedding)

        # Format the result
        result = {
            "indices": list(sparse_dict.keys()),
            "vector_values": list(sparse_dict.values()),
            "vocabulary": [
                f"dim_{i}" for i in sparse_dict.keys()
            ],  # Using dimension numbers as vocabulary
            "dictionary": json.dumps(sparse_dict).replace(" ", "").replace('"', ""),
        }

        results.append(result)

    return results


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        queries = request.form.get("queries")
        if queries:
            query_list = [q.strip() for q in queries.strip().split("\n") if q.strip()]
            if len(query_list) > 10:
                return render_template(
                    "index.html",
                    error="Maximum 10 queries allowed at once.",
                    queries=queries,
                )
            try:
                dense_embeddings = embed_query(query_list)
                sparse_embeddings = create_sparse_vector(dense_embeddings)
                combined_embeddings = list(zip(dense_embeddings, sparse_embeddings))
                return render_template(
                    "index.html",
                    combined_embeddings=combined_embeddings,
                    queries=queries,
                )
            except Exception as e:
                error_message = f"Error generating embeddings: {str(e)}"
                return render_template(
                    "index.html", error=error_message, queries=queries
                )
        return render_template(
            "index.html", error="Please enter at least one query.", queries=""
        )
    return render_template("index.html")


if __name__ == "__main__":
    app.run(debug=True)
