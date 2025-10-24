import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { SearchRequest, SearchBatchResponse } from '../types/services';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { SourcesDisplay } from '../components/SourcesDisplay';
import { Play, ArrowRight } from 'lucide-react';
import { usePersistedState } from '../hooks/usePersistedState';

export const SearchService: React.FC = () => {
  const navigate = useNavigate();
  const [partitions, setPartitions] = useState<string[]>([]);
  const [request, setRequest] = usePersistedState<SearchRequest>('search-request', {
    k: 50,
    embeddings: [{
      dense: [],
      sparse: {},
      dense_params: { n_probe: 10 },
      sparse_params: { drop_ratio_search: 0.2 }
    }],
    reranker: 'RRF',
    reranker_params: [60],
    collection_name: 'islamic_library',
    partition_names: [],
    output_fields: ['id', 'book_id', 'book_name', 'author', 'text', 'knowledge', 'category', 'header_titles', 'page_range', 'order']
  });

  const [response, setResponse] = usePersistedState<SearchBatchResponse | null>('search-response', null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<'results' | 'raw'>('search-active-tab', 'results');

  useEffect(() => {
    // Load available partitions
    const loadPartitions = async () => {
      try {
        const result = await apiService.searchPartitions();
        setPartitions(result.partitions);
      } catch (err) {
        console.error('Failed to load partitions:', err);
      }
    };
    loadPartitions();
  }, []);

  const handleSubmit = async () => {
    setError(null);
    setResponse(null);
    setLoading(true);

    try {
      const result = await apiService.search(request);
      setResponse(result);
      setActiveTab('results');
    } catch (err: unknown) {
      setError(err as { message?: string; status?: number; data?: unknown });
    } finally {
      setLoading(false);
    }
  };

  const sendToAskService = () => {
    if (!response || response.results.length === 0) return;

    // Retrieve the original query text from localStorage (stored by EmbedService)
    const queryText = localStorage.getItem('search-query-text');
    const query = queryText || 'Please provide a detailed answer based on these sources';

    // Update ask service request in localStorage
    const askRequest = {
      query,
      sources: response.results,
      temperature: 0.2,
      max_tokens: 12000,
      stream: true,
    };
    localStorage.setItem('ask-request', JSON.stringify(askRequest));

    // Navigate to ask service
    navigate('/ask');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Search Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test hybrid vector search using Milvus database with dense and sparse embeddings.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              K (Top results to retrieve: 1-100)
            </label>
            <input
              type="number"
              value={request.k}
              onChange={(e) => setRequest({ ...request, k: parseInt(e.target.value) })}
              min={1}
              max={100}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Dense Embedding (comma-separated float values)
            </label>
            <textarea
              placeholder="0.1, 0.2, 0.3, ..."
              value={request.embeddings[0]?.dense.join(', ') || ''}
              onChange={(e) => {
                const dense = e.target.value.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
                const newEmbeddings = [...request.embeddings];
                newEmbeddings[0] = { ...newEmbeddings[0], dense };
                setRequest({ ...request, embeddings: newEmbeddings });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs"
              rows={3}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Current dimension: {request.embeddings[0]?.dense.length || 0}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sparse Embedding (JSON format: {'{'}index: value{'}'})
            </label>
            <textarea
              placeholder='{"0": 0.5, "10": 0.3, "25": 0.8}'
              value={JSON.stringify(request.embeddings[0]?.sparse || {})}
              onChange={(e) => {
                try {
                  const sparse = JSON.parse(e.target.value);
                  const sparseObj: { [key: number]: number } = {};
                  Object.entries(sparse).forEach(([k, v]) => {
                    sparseObj[parseInt(k)] = v as number;
                  });
                  const newEmbeddings = [...request.embeddings];
                  newEmbeddings[0] = { ...newEmbeddings[0], sparse: sparseObj };
                  setRequest({ ...request, embeddings: newEmbeddings });
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-xs"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Collection Name
              </label>
              <input
                type="text"
                value={request.collection_name}
                onChange={(e) => setRequest({ ...request, collection_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
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
                  value={request.reranker_params[0] || 1.0}
                  onChange={(e) => {
                    const newParams = [...request.reranker_params];
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
                  value={request.reranker_params[1] || 1.0}
                  onChange={(e) => {
                    const newParams = [...request.reranker_params];
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
                value={request.reranker_params[0] || 60}
                onChange={(e) => {
                  setRequest({ ...request, reranker_params: [parseInt(e.target.value)] });
                }}
                min={1}
                max={16384}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Partitions (optional - select multiple)
            </label>
            <select
              multiple
              value={request.partition_names}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setRequest({ ...request, partition_names: selected });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              size={Math.min(5, partitions.length)}
            >
              {partitions.map(partition => (
                <option key={partition} value={partition}>{partition}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Hold Ctrl/Cmd to select multiple partitions
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || request.embeddings[0]?.dense.length === 0}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Searching...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Execute Search</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      {response && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-2">
              <div className="flex gap-1">
                {['results', 'raw'].map((tab) => (
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
              <button
                onClick={sendToAskService}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors text-sm"
              >
                <span>Send to Ask Service</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'results' && (
              <div>
                <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Found {response.processed_count} results
                </div>
                <SourcesDisplay sources={response.results} />
              </div>
            )}

            {activeTab === 'raw' && (
              <JsonViewer data={response} title="Raw Response" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
