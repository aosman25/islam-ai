import axios, { type AxiosInstance, AxiosError } from 'axios';
import type {
  GatewayRequest,
  GatewayResponse,
  AskRequest,
  AskResponse,
  SearchRequest,
  SearchBatchResponse,
  EmbeddingRequest,
  EmbeddingResponseModel,
  QueryRequest,
  QueryResponse,
  HealthResponse,
  PartitionsResponse,
  GatewayStreamChunk,
} from '../types/services';
import { SERVICES } from '../types/services';

class ApiService {
  private clients: Record<string, AxiosInstance> = {};

  constructor() {
    // Initialize axios clients for each service
    Object.entries(SERVICES).forEach(([key, config]) => {
      this.clients[key] = axios.create({
        baseURL: config.baseUrl,
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  }

  // Helper method to handle errors
  private handleError(error: unknown): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      throw {
        message: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
      };
    }
    throw error;
  }

  // Gateway Service
  async gatewayQuery(request: GatewayRequest): Promise<GatewayResponse> {
    try {
      const response = await this.clients.gateway.post<GatewayResponse>('/query', request);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Gateway streaming support
  async gatewayQueryStream(
    request: GatewayRequest,
    onChunk: (chunk: GatewayStreamChunk) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> {
    try {
      const response = await fetch(`${SERVICES.gateway.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as GatewayStreamChunk;
              onChunk(chunk);
            } catch (e) {
              console.error('Failed to parse chunk:', e);
            }
          }
        }
      }
    } catch (error) {
      onError(error as Error);
    }
  }

  async gatewayHealth(): Promise<HealthResponse> {
    try {
      const response = await this.clients.gateway.get<HealthResponse>('/health');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async gatewayReady(): Promise<HealthResponse> {
    try {
      const response = await this.clients.gateway.get<HealthResponse>('/ready');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Ask Service
  async askQuery(request: AskRequest): Promise<AskResponse> {
    try {
      const response = await this.clients.ask.post<AskResponse>('/ask', request);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async askQueryStream(
    request: AskRequest,
    onChunk: (text: string) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ): Promise<void> {
    try {
      const response = await fetch(`${SERVICES.ask.baseUrl}/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...request, stream: true }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          onComplete();
          break;
        }

        const text = decoder.decode(value, { stream: true });
        onChunk(text);
      }
    } catch (error) {
      onError(error as Error);
    }
  }

  async askHealth(): Promise<HealthResponse> {
    try {
      const response = await this.clients.ask.get<HealthResponse>('/health');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async askReady(): Promise<HealthResponse> {
    try {
      const response = await this.clients.ask.get<HealthResponse>('/ready');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Search Service
  async search(request: SearchRequest): Promise<SearchBatchResponse> {
    try {
      const response = await this.clients.search.post<SearchBatchResponse>('/search', request);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchHealth(): Promise<HealthResponse> {
    try {
      const response = await this.clients.search.get<HealthResponse>('/health');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchReady(): Promise<HealthResponse> {
    try {
      const response = await this.clients.search.get<HealthResponse>('/ready');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async searchPartitions(collectionName: string = 'islamic_library'): Promise<PartitionsResponse> {
    try {
      const response = await this.clients.search.get<PartitionsResponse>(
        `/partitions?collection_name=${collectionName}`
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Embed Service
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponseModel> {
    try {
      const response = await this.clients.embed.post<EmbeddingResponseModel>('/embed', request);
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async embedHealth(): Promise<HealthResponse> {
    try {
      const response = await this.clients.embed.get<HealthResponse>('/health');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async embedReady(): Promise<HealthResponse> {
    try {
      const response = await this.clients.embed.get<HealthResponse>('/ready');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  // Query Optimizer Service
  async optimizeQueries(request: QueryRequest): Promise<QueryResponse> {
    try {
      const response = await this.clients.queryOptimizer.post<QueryResponse>(
        '/optimize-queries',
        request
      );
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async queryOptimizerHealth(): Promise<HealthResponse> {
    try {
      const response = await this.clients.queryOptimizer.get<HealthResponse>('/health');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }

  async queryOptimizerReady(): Promise<HealthResponse> {
    try {
      const response = await this.clients.queryOptimizer.get<HealthResponse>('/ready');
      return response.data;
    } catch (error) {
      return this.handleError(error);
    }
  }
}

export const apiService = new ApiService();
