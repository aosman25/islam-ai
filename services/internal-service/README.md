# Islamic AI Services - Internal Testing Tool

A modern React + TypeScript frontend application for testing and interacting with all Islamic AI microservices.

## Features

- **Gateway Service Testing**: Complete RAG pipeline testing with streaming support
- **Ask Service Testing**: LLM response generation with customizable parameters
- **Search Service Testing**: Vector database search with hybrid embeddings
- **Embed Service Testing**: Generate dense, sparse, and ColBERT embeddings
- **Query Optimizer Testing**: Query enhancement and sub-query generation
- **Health Check Dashboard**: Monitor all services health and readiness status

### Key Capabilities

- Real-time markdown rendering for LLM responses
- Streaming support for both Gateway and Ask services
- Customizable API request parameters for all services
- JSON viewer for raw responses
- Source document display with metadata
- Dark mode support
- Responsive design

## Technologies Used

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **React Router** - Navigation
- **React Markdown** - Markdown rendering with syntax highlighting
- **Axios** - HTTP client
- **Lucide React** - Icons

## Prerequisites

- Node.js 18+ and npm (for local development)
- Docker and Docker Compose (for containerized deployment)
- All backend services running (Gateway, Ask, Search, Embed, Query Optimizer)

## Quick Start with Docker

The easiest way to run the internal service is using Docker Compose with all other services:

```bash
# From the services directory
cd services
docker-compose up -d internal-service
```

The application will be available at `http://localhost:3001`

## Local Development

### Installation

```bash
cd services/internal-service
npm install
```

### Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or `5174` if port is in use)

### Build

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Docker Deployment

### Build Docker Image

```bash
cd services/internal-service
docker build -t internal-service .
```

### Run Container Standalone

```bash
docker run -p 3001:3001 internal-service
```

### Run with Docker Compose (Production)

The internal service is included in the main `docker-compose.yml`:

```bash
# From the services directory
cd services

# Start all services including internal UI
docker-compose up -d

# Or start only internal service (with dependencies)
docker-compose up -d internal-service

# View logs
docker-compose logs -f internal-service

# Stop services
docker-compose down
```

### Run with Docker Compose (Development with Hot Reload)

For development with live code reloading:

```bash
# From the services directory
cd services

# Start all services in development mode
docker-compose -f docker-compose.dev.yml up

# Or start only internal service (with dependencies)
docker-compose -f docker-compose.dev.yml up internal-service

# View logs
docker-compose -f docker-compose.dev.yml logs -f internal-service

# Stop services
docker-compose -f docker-compose.dev.yml down
```

**Development Mode Features:**
- Hot module replacement (HMR) - changes reflect instantly
- Source code mounted as volumes
- Vite dev server running inside container
- Accessible at `http://localhost:3001`

The internal service will automatically connect to other services via the Docker network.

## Service Configuration

The internal tool uses different configurations for production and development environments:

### Production Mode (Docker Compose)

In production, only the **Gateway Service** (port 8100) and **Internal UI** (port 3001) are exposed to the host for security:

- **Gateway Service**: http://localhost:8100 (EXPOSED)
- **Internal UI**: http://localhost:3001 (EXPOSED)
- **Other services**: Not exposed (internal Docker network only)

The internal UI includes an Express.js proxy server that securely communicates with internal services through the Docker network. When you access the UI at http://localhost:3001, the frontend makes requests to `/api/gateway`, `/api/ask`, etc., which the proxy forwards to the internal Docker services.

**Architecture:**
```
Browser → http://localhost:3001/api/gateway → Express Proxy → http://gateway:8000 (Docker internal)
Browser → http://localhost:3001/api/ask → Express Proxy → http://ask-service:2000 (Docker internal)
```

### Development Mode (Docker Compose Dev)

For easier debugging, all services are exposed on their individual ports:

- **Gateway Service**: http://localhost:8100
- **Ask Service**: http://localhost:2000
- **Search Service**: http://localhost:3000
- **Embed Service**: http://localhost:4000
- **Query Optimizer**: http://localhost:5000
- **Internal UI**: http://localhost:5173 (Vite dev server with hot reload)

The frontend connects directly to each service without a proxy.

### Local Development (npm run dev)

When running `npm run dev` locally without Docker, you'll need all backend services running:

- **Gateway Service**: http://localhost:8100
- **Ask Service**: http://localhost:2000
- **Search Service**: http://localhost:3000
- **Embed Service**: http://localhost:4000
- **Query Optimizer**: http://localhost:5000
- **Internal UI**: http://localhost:5173

### How It Works

The internal UI automatically detects its environment based on the port:
- **Port 3001**: Running in production Docker → Uses proxy endpoints (`/api/*`)
- **Port 5173/5174**: Local/dev mode → Connects directly to services

The service URLs are configured in [src/types/services.ts](src/types/services.ts) and automatically adapt based on the detected port.

## Usage Guide

### Gateway Service Page

Test the complete RAG pipeline:

1. Enter your query in Arabic or English
2. Configure parameters:
   - `top_k`: Number of documents to retrieve (1-100)
   - `temperature`: LLM temperature (0.0-2.0)
   - `max_tokens`: Maximum response length (1-65536)
   - `reranker`: Choose between "Weighted" or "RRF"
   - `reranker_params`: Configure reranking strategy
   - `stream`: Enable real-time streaming responses
3. Click "Execute Query"
4. View results in tabs:
   - **Response**: Markdown-formatted LLM response
   - **Sources**: Retrieved documents with metadata
   - **Metadata**: Optimized query and sub-queries
   - **Raw**: Full JSON response

### Ask Service Page

Test LLM response generation with custom sources:

1. Enter your query
2. Add source documents using "Add Source" button
3. Configure temperature and max tokens
4. Enable streaming if desired
5. Execute and view markdown response

### Search Service Page

Test vector search directly:

1. Provide dense embeddings (comma-separated floats)
2. Provide sparse embeddings (JSON format)
3. Select partitions (optional)
4. Configure reranking strategy
5. View retrieved documents

### Embed Service Page

Generate embeddings for text:

1. Add one or more text inputs (up to 10)
2. Select embedding types:
   - Dense (for semantic search)
   - Sparse (for term matching)
   - ColBERT (for contextualized interaction)
3. Execute and view embedding dimensions

### Query Optimizer Page

Optimize queries and generate sub-queries:

1. Add queries (up to 10)
2. Execute optimization
3. View optimized query and generated sub-queries

### Health Check Dashboard

Monitor all services:

1. View real-time health and readiness status
2. Click "Refresh" to update status
3. View detailed status information for each service

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ErrorDisplay.tsx    # Error message display
│   ├── JsonViewer.tsx      # JSON response viewer
│   ├── Layout.tsx          # Main layout with sidebar
│   ├── LoadingSpinner.tsx  # Loading indicator
│   ├── MarkdownRenderer.tsx # Markdown content renderer
│   └── SourcesDisplay.tsx  # Source documents display
├── pages/               # Service testing pages
│   ├── AskService.tsx
│   ├── EmbedService.tsx
│   ├── GatewayService.tsx
│   ├── HealthCheck.tsx
│   ├── QueryOptimizerService.tsx
│   └── SearchService.tsx
├── services/            # API service layer
│   └── api.ts              # HTTP client wrapper
├── types/               # TypeScript type definitions
│   └── services.ts         # Service interfaces
├── App.tsx              # Main app component
└── main.tsx            # Entry point
```

## Key Features Details

### Streaming Support

Both Gateway Service and Ask Service support streaming responses:
- Real-time text generation display
- Metadata arrives before content (Gateway)
- Stop button to cancel streaming
- Automatic reconnection handling

### Markdown Rendering

All LLM responses are rendered with:
- Syntax highlighting for code blocks
- Proper heading hierarchy
- Lists and blockquotes
- Links and emphasis
- Arabic text support

### Source Documents

Source display includes:
- Book name and author
- Category and knowledge type
- Page range information
- Header titles (breadcrumb navigation)
- Full text content
- Similarity scores

### Dark Mode

The application automatically adapts to your system's dark mode preference.

## Development Tips

1. **Hot Module Replacement**: Changes are reflected instantly during development
2. **Type Safety**: TypeScript ensures type correctness across all API calls
3. **Error Handling**: Comprehensive error display with detailed messages
4. **Request Tracking**: All requests include request IDs for debugging

## Troubleshooting

### Services Not Connecting

**For Production Docker (port 3001):**
```bash
# Check proxy endpoints through internal-service
curl http://localhost:3001/api/health
curl http://localhost:3001/api/gateway/health

# Check gateway directly
curl http://localhost:8100/health
```

**For Development/Local (port 5173):**
```bash
# Check if services are accessible directly
curl http://localhost:8100/health
curl http://localhost:2000/health
curl http://localhost:3000/health
curl http://localhost:4000/health
curl http://localhost:5000/health
```

### CORS Issues

If you encounter CORS errors, ensure backend services allow the frontend origin:
- Development: `http://localhost:5173`
- Production: Configure appropriate origin

### Build Issues

Clear node_modules and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

## Contributing

When adding new features:
1. Follow existing TypeScript patterns
2. Use type-safe API calls
3. Maintain consistent UI patterns
4. Add error handling
5. Update this README

## License

This is an internal testing tool for the Islamic AI Services project.
