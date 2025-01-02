from flask import Flask, render_template, request
from pymilvus import model
import os
from dotenv import load_dotenv

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

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        queries = request.form.get('queries')
        if queries:
            query_list = [q.strip() for q in queries.strip().split('\n') if q.strip()]
            if len(query_list) > 10:
                return render_template('index.html', 
                    error='Maximum 10 queries allowed at once.', 
                    queries=queries)
            try:
                embeddings = embed_query(query_list)
                return render_template('index.html', 
                    embeddings=embeddings, 
                    queries=queries)
            except Exception as e:
                error_message = f"Error generating embeddings: {str(e)}"
                return render_template('index.html', 
                    error=error_message, 
                    queries=queries)
        return render_template('index.html', 
            error='Please enter at least one query.', 
            queries='')
    return render_template('index.html')

if __name__ == '__main__':
    app.run()