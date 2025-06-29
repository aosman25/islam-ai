from flask import Flask, render_template, request
import os
import httpx
from dotenv import load_dotenv
from typing import List, Dict
import json

# Load environment variables
load_dotenv()

app = Flask(__name__)


def embed_query(queries: List[str]) -> Dict[str, List]:
    payload = {
        "input_text": queries,
        "dense": True,
        "sparse": True,
        "colbert": False
    }

    url = os.getenv("QUERY_SERVER_URL_INTERNAL") if os.getenv("TESTING") == "FALSE" else os.getenv("QUERY_SERVER_URL_TESTING")
    timeout = httpx.Timeout(30.0)

    try:
        with httpx.Client(timeout=timeout) as client:
            response = client.post(url, json=payload)
    except httpx.RequestError as e:
        raise RuntimeError(f"Failed to reach embedding server: {e}") from e

    if response.status_code == 200:
        return response.json()
    else:
        raise RuntimeError(f"Embedding server error {response.status_code}: {response.text}")


@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        queries = request.form.get("queries")
        if queries:
            query_list = [
                q.replace("\r", "").strip()
                for q in queries.split("\n")
                if q.replace("\r", "").strip() != ""
            ]
            if len(query_list) > 10:
                return render_template(
                    "index.html",
                    error="Maximum 10 queries allowed at once.",
                    queries=queries,
                )
            try:
                embeddings = embed_query(query_list)
                dense_embeddings = embeddings.get("dense", [])
                sparse_embeddings = embeddings.get("sparse", [])
                print(sparse_embeddings)
                combined_embeddings = list(zip(dense_embeddings, sparse_embeddings))
                return render_template(
                    "index.html",
                    combined_embeddings=combined_embeddings,
                    queries=queries,
                    query_list=query_list,
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
    app.run()
