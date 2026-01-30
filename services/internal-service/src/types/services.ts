// Common types
export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}

export interface ErrorResponse {
  error: string;
  request_id: string;
  timestamp: string;
}

// Source data structure used across services
export interface SourceData {
  distance: number;
  id: number;
  book_id: number;
  book_name: string;
  order: number;
  author: string;
  category: string;
  part_title: string;
  start_page_id: number;
  page_offset: number;
  page_num_range: number[];
  text: string;
}

// Gateway Service Types
export interface GatewayRequest {
  query: string;
  top_k?: number;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  reranker?: 'RRF' | 'Weighted';
  reranker_params?: (number | number[]);
}

export interface GatewayResponse {
  response: string;
  sources: SourceData[];
  optimized_query: string;
  subqueries: string[];
  request_id: string;
}

export interface GatewayStreamChunk {
  type: 'metadata' | 'content' | 'done';
  delta?: string;
  sources?: SourceData[];
  optimized_query?: string;
  subqueries?: string[];
  request_id?: string;
}

// Ask Service Types
export interface AskRequest {
  query: string;
  sources: SourceData[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface AskResponse {
  response: string;
  request_id: string;
}

// Search Service Types
export interface EmbeddingObject {
  dense: number[];
  sparse: { [key: number]: number };
  dense_params?: {
    n_probe?: number;
  };
  sparse_params?: {
    drop_ratio_search?: number;
  };
}

export interface SearchRequest {
  k?: number;
  embeddings: EmbeddingObject[];
  reranker?: 'RRF' | 'Weighted';
  reranker_params?: (number | number[]);
  collection_name?: string;
  partition_names?: string[];
  output_fields?: string[];
}

export interface SearchResponse {
  distance: number;
  id: number;
  book_id: number;
  book_name: string;
  order: number;
  author: string;
  category: string;
  part_title: string;
  start_page_id: number;
  page_offset: number;
  page_num_range: number[];
  text: string;
}

export interface SearchBatchResponse {
  results: SearchResponse[];
  processed_count: number;
  request_id: string;
}

export interface PartitionsResponse {
  collection_name: string;
  partitions: string[];
  count: number;
  timestamp: string;
}

// Embed Service Types
export interface EmbeddingRequest {
  input_text: string[];
  dense?: boolean;
  sparse?: boolean;
  colbert?: boolean;
}

export interface EmbeddingResponseModel {
  dense?: number[][];
  sparse?: { [key: number]: number }[];
  colbert?: number[][];
  processed_count: number;
  request_id: string;
}

// Query Optimizer Service Types
export interface QueryRequest {
  queries: string[];
}

export interface OptimizedQueryResponse {
  optimized_query: string;
  sub_queries?: string[];
}

export interface QueryResponse {
  results: OptimizedQueryResponse[];
  processed_count: number;
  request_id: string;
}

// Service configuration
export interface ServiceConfig {
  name: string;
  baseUrl: string;
  port: number;
  description: string;
}

// Determine base URLs based on environment
// When accessed through internal-service proxy (port 3001), use relative /api/* endpoints
// When in local dev (port 5173/5174), connect directly to services
const isProxyMode = window.location.port === '3001';

// Direct service port mappings (for local development and Docker dev mode)
const SERVICE_PORTS = {
  gateway: 8100,
  ask: 2000,
  search: 3000,
  embed: 4000,
  queryOptimizer: 5000,
};

const getServiceUrl = (serviceName: keyof typeof SERVICE_PORTS): string => {
  // If running through proxy (production Docker), use proxy endpoints
  if (isProxyMode) {
    return `/api/${serviceName === 'queryOptimizer' ? 'query-optimizer' : serviceName}`;
  }

  // For local development, connect directly to services
  const port = SERVICE_PORTS[serviceName];
  return `http://localhost:${port}`;
};

export const SERVICES: Record<string, ServiceConfig> = {
  gateway: {
    name: 'Gateway Service',
    baseUrl: getServiceUrl('gateway'),
    port: 8100,
    description: 'Main orchestrator for the RAG pipeline'
  },
  ask: {
    name: 'Ask Service',
    baseUrl: getServiceUrl('ask'),
    port: 2000,
    description: 'LLM response generation using Google Gemini'
  },
  search: {
    name: 'Search Service',
    baseUrl: getServiceUrl('search'),
    port: 3000,
    description: 'Hybrid vector search using Milvus'
  },
  embed: {
    name: 'Embed Service',
    baseUrl: getServiceUrl('embed'),
    port: 4000,
    description: 'Text embeddings generation'
  },
  queryOptimizer: {
    name: 'Query Optimizer Service',
    baseUrl: getServiceUrl('queryOptimizer'),
    port: 5000,
    description: 'Query optimization and sub-query generation'
  }
};
