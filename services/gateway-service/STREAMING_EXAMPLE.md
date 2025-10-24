# Streaming Response Format

When using `stream: true` in the gateway service, the response is returned as **newline-delimited JSON (NDJSON)**.

## Response Format

The stream consists of three types of chunks, each as a complete JSON object on its own line:

### 1. Metadata Chunk (First)
```json
{
  "type": "metadata",
  "sources": [
    {
      "distance": 0.85,
      "id": "doc123",
      "book_id": "book456",
      "book_name": "Example Book",
      "order": 1,
      "author": "Author Name",
      "knowledge": "Islamic Knowledge",
      "category": "Fiqh",
      "header_titles": ["Chapter 1", "Section 2"],
      "page_range": [10, 15],
      "text": "Source text content..."
    }
  ],
  "optimized_query": "What is the ruling on fasting in Ramadan?",
  "subqueries": [
    "What are the conditions for valid fasting?",
    "What breaks the fast in Islam?",
    "Is fasting obligatory in Ramadan?"
  ],
  "request_id": "req_1234567890"
}
```

### 2. Content Chunks (Multiple)
```json
{"type": "content", "delta": "The ruling"}
{"type": "content", "delta": " on this"}
{"type": "content", "delta": " matter is..."}
```

### 3. Done Chunk (Last)
```json
{"type": "done"}
```

## Client Implementation Examples

### Python Example
```python
import httpx
import json

async def stream_query():
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "http://localhost:8100/query",
            json={
                "query": "What is the ruling on fasting?",
                "stream": True
            }
        ) as response:
            sources = None
            optimized_query = None
            subqueries = []
            request_id = None
            full_text = ""

            async for line in response.aiter_lines():
                if not line:
                    continue

                chunk = json.loads(line)

                if chunk["type"] == "metadata":
                    sources = chunk["sources"]
                    optimized_query = chunk["optimized_query"]
                    subqueries = chunk.get("subqueries", [])
                    request_id = chunk["request_id"]
                    print(f"Request ID: {request_id}")
                    print(f"Optimized Query: {optimized_query}")
                    print(f"Subqueries: {', '.join(subqueries) if subqueries else 'None'}")
                    print(f"Found {len(sources)} sources")

                elif chunk["type"] == "content":
                    delta = chunk["delta"]
                    full_text += delta
                    print(delta, end="", flush=True)

                elif chunk["type"] == "done":
                    print("\n\nStreaming complete!")

            print(f"\n\nFull response: {full_text}")
            print(f"Sources count: {len(sources)}")
```

### JavaScript/TypeScript Example
```typescript
async function streamQuery() {
  const response = await fetch("http://localhost:8100/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "What is the ruling on fasting?",
      stream: true
    })
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  let sources = [];
  let optimizedQuery = "";
  let subqueries = [];
  let requestId = "";
  let fullText = "";

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter(line => line.trim());

    for (const line of lines) {
      const data = JSON.parse(line);

      if (data.type === "metadata") {
        sources = data.sources;
        optimizedQuery = data.optimized_query;
        subqueries = data.subqueries || [];
        requestId = data.request_id;
        console.log(`Request ID: ${requestId}`);
        console.log(`Optimized Query: ${optimizedQuery}`);
        console.log(`Subqueries: ${subqueries.join(', ') || 'None'}`);
        console.log(`Found ${sources.length} sources`);
      } else if (data.type === "content") {
        fullText += data.delta;
        process.stdout.write(data.delta); // Stream to console
      } else if (data.type === "done") {
        console.log("\n\nStreaming complete!");
      }
    }
  }
}
```

### cURL Example
```bash
# Stream the response
curl -X POST http://localhost:8100/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the ruling on fasting?",
    "stream": true
  }' \
  --no-buffer

# Output:
# {"type":"metadata","sources":[...],"optimized_query":"What is the ruling on fasting in Ramadan?","subqueries":["What are the conditions for valid fasting?","What breaks the fast in Islam?"],"request_id":"req_123"}
# {"type":"content","delta":"The"}
# {"type":"content","delta":" ruling"}
# {"type":"content","delta":" is..."}
# {"type":"done"}
```

## Benefits of This Format

1. **Immediate Metadata**: Client receives sources, optimized query, and subqueries immediately, can display them while response streams
2. **Progressive Display**: Can render text incrementally as it arrives
3. **Query Insights**: Subqueries help understand how the system decomposed the original question
4. **Clear Completion**: `done` chunk signals when streaming is complete
5. **Structured Data**: Each chunk is valid JSON, easy to parse
6. **Error Handling**: Can detect incomplete streams if `done` chunk never arrives

## Non-Streaming Response (stream=false)

When `stream: false`, you get a single JSON response:

```json
{
  "response": "The complete response text...",
  "sources": [...],
  "optimized_query": "What is the ruling on fasting in Ramadan?",
  "subqueries": [
    "What are the conditions for valid fasting?",
    "What breaks the fast in Islam?",
    "Is fasting obligatory in Ramadan?"
  ],
  "request_id": "req_1234567890"
}
```
