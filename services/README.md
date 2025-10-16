# RAG Pipeline Services

Complete end-to-end RAG (Retrieval-Augmented Generation) pipeline for the AI Muslim Chatbot, composed of 5 microservices orchestrated by Docker Compose.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         User Request                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Gateway Service (Port 8100)                     │
│           Single API endpoint for RAG pipeline               │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Query      │   │   Embed      │   │   Search     │
│  Optimizer   │──▶│   Service    │──▶│   Service    │
│ (Port 5000)  │   │ (Port 4000)  │   │ (Port 3000)  │
└──────────────┘   └──────────────┘   └──────────────┘
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │     Ask      │
                                      │   Service    │
                                      │ (Port 2000)  │
                                      └──────────────┘
                                              │
                                              ▼
                                      AI Response
```

## Services

### 1. Gateway Service (Port 8100)
**Main Entry Point** - Orchestrates the entire RAG pipeline

- **Purpose**: Single unified API endpoint that coordinates all microservices
- **Technology**: FastAPI, httpx
- **Features**: Streaming/non-streaming responses, request tracking, error handling

### 2. Query Optimizer Service (Port 5000)
**Query Enhancement** - Optimizes and refines user queries

- **Purpose**: Improves query quality using Google Gemini AI
- **Technology**: FastAPI, Google Gemini API
- **Input**: Raw user query
- **Output**: Optimized query with sub-queries

### 3. Embed Service (Port 4000)
**Embedding Generation** - Converts text to vector embeddings

- **Purpose**: Generates dense and sparse embeddings for semantic search
- **Technology**: FastAPI, DeepInfra API (BAAI/bge-m3-multi)
- **Input**: Optimized query text
- **Output**: Dense and sparse vector embeddings

### 4. Search Service (Port 3000)
**Vector Search** - Searches the vector database

- **Purpose**: Performs hybrid search on Milvus vector database
- **Technology**: FastAPI, Milvus/pymilvus
- **Input**: Query embeddings
- **Output**: Relevant document chunks from Islamic library

### 5. Ask Service (Port 2000)
**Response Generation** - Generates AI responses

- **Purpose**: Creates contextual answers using retrieved documents
- **Technology**: FastAPI, Google Gemini API
- **Input**: User query + retrieved source documents
- **Output**: AI-generated response (streaming or non-streaming)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- API keys for:
  - Google Gemini API
  - DeepInfra API
- Access to Milvus vector database

### Setup

1. **Navigate to services folder:**
   ```bash
   cd services/
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` with your actual values:**
   ```bash
   # Required values:
   GEMINI_API_KEY=your_gemini_api_key
   DEEPINFRA_API_KEY=your_deepinfra_api_key
   MILVUS_TOKEN=root:Milvus
   MILVUS_IP_ADDRESS=your_milvus_ip
   ```

4. **Start all services:**
   ```bash
   docker-compose up -d
   ```

5. **Verify services are running:**
   ```bash
   docker-compose ps
   ```

6. **Test the gateway:**
   ```bash
   curl -X POST http://localhost:8100/query \
     -H "Content-Type: application/json" \
     -d '{
       "query": "What is the meaning of Islam?",
       "top_k": 15,
       "stream": false
     }'
   ```

### Stopping Services

```bash
docker-compose down
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f gateway
docker-compose logs -f query-optimizer
docker-compose logs -f embed-service
docker-compose logs -f search-service
docker-compose logs -f ask-service
```

## Configuration

All services share a single `.env` file located in this folder. Key configuration options:

### API Keys (Required)
```bash
GEMINI_API_KEY=your_key_here
DEEPINFRA_API_KEY=your_key_here
```

### Milvus Configuration (Required)
```bash
MILVUS_TOKEN=root:Milvus
MILVUS_IP_ADDRESS=your_milvus_ip
```

### Service URLs (Auto-configured in Docker)
```bash
QUERY_OPTIMIZER_URL=http://query-optimizer:5000
EMBED_SERVICE_URL=http://embed-service:4000
SEARCH_SERVICE_URL=http://search-service:3000
ASK_SERVICE_URL=http://ask-service:2000
```

### Optional Settings
```bash
LOG_LEVEL=INFO
REQUEST_TIMEOUT=120
ALLOWED_ORIGINS=*
```

See `.env.example` for all available options.

## API Usage

### Gateway Service Endpoint

**POST** `/query` - Process a complete RAG query

**Request:**
```json
{
  "query": "What is the meaning of Islam?",
  "top_k": 15,
  "temperature": 0.7,
  "max_tokens": 20000,
  "stream": false
}
```

**Response (Non-streaming):**
```json
{
  "response": "Islam means submission to the will of Allah...",
  "sources": [
    {
      "book_name": "...",
      "author": "...",
      "text": "...",
      ...
    }
  ],
  "optimized_query": "meaning and definition of Islam",
  "request_id": "req_1234567890"
}
```

**Streaming Response:**
Set `"stream": true` to receive a text/plain streaming response.

### Individual Service Endpoints

Each service also exposes its own API:

- **Query Optimizer**: `http://localhost:5000/optimize-queries`
- **Embed Service**: `http://localhost:4000/embed`
- **Search Service**: `http://localhost:3000/search`
- **Ask Service**: `http://localhost:2000/ask`

See individual service READMEs for detailed API documentation.

## Development

### Running Individual Services Locally

To develop on a single service without Docker:

1. Install dependencies:
   ```bash
   cd <service-name>/
   pip install -r requirements.txt
   ```

2. Ensure `.env` file exists in `services/` folder

3. Run the service:
   ```bash
   python main.py
   ```

### Building Individual Services

```bash
# From services folder
docker build -t gateway-service ./gateway-service
docker build -t query-optimizer ./query-optimizer-service
docker build -t embed-service ./embed-service
docker build -t search-service ./search-service
docker build -t ask-service ./ask-service
```

## Monitoring

### Health Checks

All services expose health check endpoints:

```bash
curl http://localhost:8100/health  # Gateway
curl http://localhost:5000/health  # Query Optimizer
curl http://localhost:4000/health  # Embed Service
curl http://localhost:3000/health  # Search Service
curl http://localhost:2000/health  # Ask Service
```

### Service Status

```bash
docker-compose ps
```

### Resource Usage

```bash
docker stats
```

## Troubleshooting

### Services not starting
1. Check Docker logs: `docker-compose logs <service-name>`
2. Verify `.env` file has all required values
3. Ensure no port conflicts with existing services

### Connection errors between services
- Services communicate via Docker network `rag-network`
- Ensure all services are running: `docker-compose ps`
- Check network: `docker network inspect rag-network`

### API key errors
- Verify API keys in `.env` are correct and active
- Check service logs for authentication errors

## Production Considerations

For production deployment:

1. **Security**:
   - Use secrets management (e.g., Docker secrets, HashiCorp Vault)
   - Enable HTTPS/TLS
   - Implement rate limiting
   - Add authentication/authorization

2. **Scaling**:
   - Deploy on Kubernetes for better orchestration
   - Scale services independently based on load
   - Use load balancers

3. **Monitoring**:
   - Integrate with Prometheus/Grafana
   - Set up alerting
   - Enable distributed tracing (OpenTelemetry)

4. **Reliability**:
   - Implement circuit breakers
   - Add retry mechanisms with exponential backoff
   - Use service mesh (e.g., Istio)

## License

See root project LICENSE file.
