import { useState } from 'react';
import { apiService } from '../services/api';
import type { GatewayRequest, GatewayResponse, GatewayStreamChunk, SourceData } from '../types/services';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { SourcesDisplay } from '../components/SourcesDisplay';
import { Play, Square } from 'lucide-react';
import { getTextDirectionStyles } from '../utils/textDirection';
import { usePersistedState } from '../hooks/usePersistedState';

export const GatewayService: React.FC = () => {
  const [request, setRequest] = usePersistedState<GatewayRequest>('gateway-request', {
    query: '',
    top_k: 50,
    temperature: 0.2,
    max_tokens: 65536,
    stream: true,
    reranker: 'RRF',
    reranker_params: [60],
  });

  const [response, setResponse] = usePersistedState<GatewayResponse | null>('gateway-response', null);
  const [streamingText, setStreamingText] = usePersistedState<string>('gateway-streaming-text', '');
  const [streamMetadata, setStreamMetadata] = usePersistedState<{
    sources: SourceData[];
    hypothetical_passages: string[];
    keywords: string[];
    request_id: string;
  } | null>('gateway-stream-metadata', null);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<'response' | 'sources' | 'metadata' | 'raw'>('gateway-active-tab', 'response');

  const handleSubmit = async () => {
    setError(null);
    setResponse(null);
    setStreamingText('');
    setStreamMetadata(null);

    if (request.stream) {
      setStreaming(true);
      await apiService.gatewayQueryStream(
        request,
        (chunk: GatewayStreamChunk) => {
          if (chunk.type === 'metadata') {
            setStreamMetadata({
              sources: chunk.sources || [],
              hypothetical_passages: chunk.hypothetical_passages || [],
              keywords: chunk.keywords || [],
              request_id: chunk.request_id || '',
            });
          } else if (chunk.type === 'content' && chunk.delta) {
            setStreamingText((prev) => prev + chunk.delta);
          }
        },
        (err) => {
          setError({ message: err.message });
          setStreaming(false);
        },
        () => {
          setStreaming(false);
        }
      );
    } else {
      setLoading(true);
      try {
        const result = await apiService.gatewayQuery(request);
        setResponse(result);
        setActiveTab('response');
      } catch (err: unknown) {
        setError(err as { message?: string; status?: number; data?: unknown });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleStop = () => {
    setStreaming(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Gateway Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test the complete RAG pipeline with query optimization, embedding, search, and LLM generation.
        </p>
      </div>

      {/* Request Form */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Query (1-1000 characters)
            </label>
            <textarea
              value={request.query}
              onChange={(e) => setRequest({ ...request, query: e.target.value })}
              placeholder="What are the pillars of Islam?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={getTextDirectionStyles(request.query)}
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {request.query.length}/1000 characters
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Top K (1-100)
              </label>
              <input
                type="number"
                value={request.top_k}
                onChange={(e) => setRequest({ ...request, top_k: parseInt(e.target.value) })}
                min={1}
                max={100}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Temperature (0.0-2.0)
              </label>
              <input
                type="number"
                value={request.temperature}
                onChange={(e) => setRequest({ ...request, temperature: parseFloat(e.target.value) })}
                min={0}
                max={2}
                step={0.1}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Max Tokens (1-65536)
              </label>
              <input
                type="number"
                value={request.max_tokens}
                onChange={(e) => setRequest({ ...request, max_tokens: parseInt(e.target.value) })}
                min={1}
                max={65536}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reranker
              </label>
              <select
                value={request.reranker}
                onChange={(e) => {
                  const newReranker = e.target.value as 'RRF' | 'Weighted';
                  setRequest({
                    ...request,
                    reranker: newReranker,
                    reranker_params: newReranker === 'RRF' ? [60] : [1.0, 1.0]
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="Weighted">Weighted</option>
                <option value="RRF">RRF</option>
              </select>
            </div>
          </div>

          {/* Dynamic Reranker Params */}
          {request.reranker === 'Weighted' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Dense Weight (0.0-1.0)
                </label>
                <input
                  type="number"
                  value={Array.isArray(request.reranker_params) ? (request.reranker_params[0] ?? 1.0) : 1.0}
                  onChange={(e) => {
                    const currentParams = Array.isArray(request.reranker_params) ? request.reranker_params : [1.0, 1.0];
                    const newParams = [...currentParams];
                    newParams[0] = parseFloat(e.target.value);
                    setRequest({ ...request, reranker_params: newParams });
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Sparse Weight (0.0-1.0)
                </label>
                <input
                  type="number"
                  value={Array.isArray(request.reranker_params) ? (request.reranker_params[1] ?? 1.0) : 1.0}
                  onChange={(e) => {
                    const currentParams = Array.isArray(request.reranker_params) ? request.reranker_params : [1.0, 1.0];
                    const newParams = [...currentParams];
                    newParams[1] = parseFloat(e.target.value);
                    setRequest({ ...request, reranker_params: newParams });
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                RRF K Value (1-16384)
              </label>
              <input
                type="number"
                value={Array.isArray(request.reranker_params) ? (request.reranker_params[0] ?? 60) : 60}
                onChange={(e) => {
                  setRequest({ ...request, reranker_params: [parseInt(e.target.value)] });
                }}
                min={1}
                max={16384}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="stream"
              checked={request.stream}
              onChange={(e) => setRequest({ ...request, stream: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
            <label htmlFor="stream" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Enable Streaming
            </label>
          </div>

          <button
            onClick={streaming ? handleStop : handleSubmit}
            disabled={loading || !request.query.trim()}
            className={`w-full px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              streaming
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
            }`}
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Processing...</span>
              </>
            ) : streaming ? (
              <>
                <Square className="w-4 h-4" />
                <span>Stop Streaming</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Execute Query</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && <ErrorDisplay error={error} />}

      {/* Response Display */}
      {(response || streaming || streamingText) && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1 p-2">
              {['response', 'sources', 'metadata', 'raw'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'response' && (
              <div>
                {streaming && !streamingText && streamMetadata && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <LoadingSpinner size="sm" />
                    <span>Generating response from {streamMetadata.sources.length} sources...</span>
                  </div>
                )}
                {streaming && streamingText && (
                  <div className="mb-2 text-sm text-blue-600 dark:text-blue-400">Streaming...</div>
                )}
                <MarkdownRenderer content={response?.response || streamingText} />
              </div>
            )}

            {activeTab === 'sources' && (
              <SourcesDisplay sources={response?.sources || streamMetadata?.sources || []} />
            )}

            {activeTab === 'metadata' && (
              <div className="space-y-4">
                {(response?.hypothetical_passages || streamMetadata?.hypothetical_passages || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Hypothetical Passages (HyDE)
                    </h4>
                    <div className="space-y-2">
                      {(response?.hypothetical_passages || streamMetadata?.hypothetical_passages || []).map((passage, idx) => (
                        <p
                          key={idx}
                          className="text-sm bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-gray-100"
                          style={getTextDirectionStyles(passage)}
                        >
                          {passage}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {(response?.keywords || streamMetadata?.keywords || []).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Keywords
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(response?.keywords || streamMetadata?.keywords || []).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="text-sm text-white bg-blue-600 dark:bg-blue-700 px-3 py-1 rounded-full"
                          style={getTextDirectionStyles(keyword)}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Request ID
                  </h4>
                  <p className="text-sm font-mono text-white bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                    {response?.request_id || streamMetadata?.request_id}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'raw' && (
              <JsonViewer
                data={response || {
                  metadata: streamMetadata,
                  content: streamingText
                }}
                title="Raw Response"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
