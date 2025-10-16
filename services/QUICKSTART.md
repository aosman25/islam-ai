# Quick Start Guide - RAG Pipeline

Get the complete RAG pipeline running in 5 minutes!

## Prerequisites

- ✅ Docker and Docker Compose installed
- ✅ Google Gemini API key ([Get one here](https://aistudio.google.com/app/apikey))
- ✅ DeepInfra API key ([Get one here](https://deepinfra.com/))
- ✅ Milvus database access (IP address and token)

## Steps

### 1. Navigate to Services Folder

```bash
cd services/
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Edit Configuration

Open `.env` and add your credentials:

```bash
# Minimum required configuration
GEMINI_API_KEY=your_gemini_api_key_here
DEEPINFRA_API_KEY=your_deepinfra_api_key_here
MILVUS_TOKEN=root:Milvus
MILVUS_IP_ADDRESS=your_milvus_ip_address
```

### 4. Start All Services

```bash
docker-compose up -d
```

This will start all 5 services:
- Gateway Service (Port 8100)
- Query Optimizer (Port 5000)
- Embed Service (Port 4000)
- Search Service (Port 3000)
- Ask Service (Port 2000)

### 5. Wait for Services to Start

Check status (all services should show "Up"):

```bash
docker-compose ps
```

### 6. Test the Pipeline

**Test 1: Health Check**
```bash
curl http://localhost:8100/health
```

Expected response:
```json
{"status":"healthy","timestamp":"...","version":"1.0.0"}
```

**Test 2: Query the RAG Pipeline**
```bash
curl -X POST http://localhost:8100/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the meaning of Islam?",
    "top_k": 5,
    "stream": false
  }'
```

Expected response:
```json
{
  "response": "Islam means submission to the will of Allah...",
  "sources": [...],
  "optimized_query": "...",
  "request_id": "req_..."
}
```

**Test 3: Streaming Response**
```bash
curl -X POST http://localhost:8100/query \
  -H "Content-Type: application/json" \
  -N \
  -d '{
    "query": "What is the meaning of Islam?",
    "stream": true
  }'
```

## Usage Examples

### Python

```python
import requests

response = requests.post(
    "http://localhost:8100/query",
    json={
        "query": "What is the meaning of Islam?",
        "top_k": 15,
        "temperature": 0.7,
        "stream": False
    }
)

data = response.json()
print(f"Response: {data['response']}")
print(f"Sources: {len(data['sources'])} documents")
```

### JavaScript/TypeScript

```javascript
const response = await fetch('http://localhost:8100/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'What is the meaning of Islam?',
    top_k: 15,
    stream: false
  })
});

const data = await response.json();
console.log('Response:', data.response);
console.log('Sources:', data.sources.length, 'documents');
```

### Streaming with Python

```python
import httpx

async with httpx.AsyncClient() as client:
    async with client.stream(
        'POST',
        'http://localhost:8100/query',
        json={'query': 'What is the meaning of Islam?', 'stream': True}
    ) as response:
        async for chunk in response.aiter_text():
            print(chunk, end='', flush=True)
```

## Common Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f gateway
docker-compose logs -f query-optimizer
```

### Stop Services
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild Services (after code changes)
```bash
docker-compose up -d --build
```

### Check Service Status
```bash
docker-compose ps
```

## Troubleshooting

### Services won't start
1. Check logs: `docker-compose logs`
2. Verify `.env` file has all required keys
3. Ensure ports are not in use: `netstat -an | grep -E "8100|5000|4000|3000|2000"`

### API errors
- Verify API keys are correct in `.env`
- Check API key quotas/limits
- View service logs: `docker-compose logs <service-name>`

### Connection timeouts
- Increase `REQUEST_TIMEOUT` in `.env`
- Check Milvus database is accessible
- Verify network connectivity

### Empty responses
- Check ask-service logs: `docker-compose logs ask-service`
- Verify Milvus has data indexed
- Check search-service returns results

## Next Steps

- Read the full [README.md](README.md) for detailed documentation
- Explore individual service APIs
- Check service-specific READMEs in each service folder
- Customize configuration in `.env`

## Support

For issues or questions:
- Check service logs: `docker-compose logs <service-name>`
- Review individual service documentation
- Check the main project README

## Architecture

```
User → Gateway (8100)
         ↓
       Query Optimizer (5000)
         ↓
       Embed Service (4000)
         ↓
       Search Service (3000)
         ↓
       Ask Service (2000)
         ↓
       Response
```

Happy building! 🚀
