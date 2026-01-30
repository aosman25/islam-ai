import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { EmbeddingRequest, EmbeddingResponseModel } from '../types/services';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Plus, Trash2, ArrowRight, Copy, Check } from 'lucide-react';
import { getTextDirectionStyles } from '../utils/textDirection';
import { usePersistedState } from '../hooks/usePersistedState';

export const EmbedService: React.FC = () => {
  const navigate = useNavigate();
  const [request, setRequest] = usePersistedState<EmbeddingRequest>('embed-request', {
    input_text: [''],
    dense: true,
    sparse: true,
  });

  const [response, setResponse] = usePersistedState<EmbeddingResponseModel | null>('embed-response', null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);
  const [copiedDense, setCopiedDense] = useState<number | null>(null);
  const [copiedSparse, setCopiedSparse] = useState<number | null>(null);

  const addText = () => {
    setRequest({ ...request, input_text: [...request.input_text, ''] });
  };

  const removeText = (index: number) => {
    const newTexts = request.input_text.filter((_, idx) => idx !== index);
    setRequest({ ...request, input_text: newTexts });
  };

  const updateText = (index: number, value: string) => {
    const newTexts = [...request.input_text];
    newTexts[index] = value;
    setRequest({ ...request, input_text: newTexts });
  };

  const handleSubmit = async () => {
    setError(null);
    setResponse(null);
    setLoading(true);

    try {
      const result = await apiService.embed(request);
      setResponse(result);
    } catch (err: unknown) {
      setError(err as { message?: string; status?: number; data?: unknown });
    } finally {
      setLoading(false);
    }
  };

  const sendSingleQueryToSearch = (queryIndex: number) => {
    if (!response) return;

    // Build embedding for single query
    const embedding = {
      dense: response.dense ? response.dense[queryIndex] : [],
      sparse: response.sparse ? response.sparse[queryIndex] : {},
      dense_params: { n_probe: 10 },
      sparse_params: { drop_ratio_search: 0.2 }
    };

    // Update search service request in localStorage
    const searchRequest = {
      k: 50,
      embeddings: [embedding],
      reranker: 'RRF' as const,
      reranker_params: [60],
      collection_name: 'islamic_library',
      partition_names: [],
      output_fields: ['id', 'book_id', 'book_name', 'author', 'text', 'category', 'part_title', 'start_page_id', 'page_offset', 'page_num_range', 'order']
    };
    localStorage.setItem('search-request', JSON.stringify(searchRequest));

    // Store the original query text for the Ask service
    localStorage.setItem('search-query-text', request.input_text[queryIndex]);

    // Navigate to search service
    navigate('/search');
  };

  const copyDenseEmbedding = async (queryIndex: number) => {
    if (!response?.dense?.[queryIndex]) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(response.dense[queryIndex], null, 2));
      setCopiedDense(queryIndex);
      setTimeout(() => setCopiedDense(null), 2000);
    } catch (err) {
      console.error('Failed to copy dense embedding:', err);
    }
  };

  const copySparseEmbedding = async (queryIndex: number) => {
    if (!response?.sparse?.[queryIndex]) return;

    try {
      await navigator.clipboard.writeText(JSON.stringify(response.sparse[queryIndex], null, 2));
      setCopiedSparse(queryIndex);
      setTimeout(() => setCopiedSparse(null), 2000);
    } catch (err) {
      console.error('Failed to copy sparse embedding:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Embed Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Generate dense, sparse, and ColBERT embeddings for text using DeepInfra API.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Input Texts (1-10 texts, max 8000 chars each)
              </label>
              <button
                onClick={addText}
                disabled={request.input_text.length >= 10}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Text
              </button>
            </div>

            <div className="space-y-3">
              {request.input_text.map((text, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1">
                    <textarea
                      value={text}
                      onChange={(e) => updateText(idx, e.target.value)}
                      placeholder={idx === 0 ? "What are the pillars of Islam?" : `Text ${idx + 1}...`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      style={getTextDirectionStyles(text)}
                      rows={2}
                      maxLength={8000}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {text.length}/8000 characters
                    </p>
                  </div>
                  {request.input_text.length > 1 && (
                    <button
                      onClick={() => removeText(idx)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || request.input_text.some(t => !t.trim())}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Generating Embeddings...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Generate Embeddings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      {response && (
        <div className="space-y-4">
          {/* Individual Query Cards */}
          {request.input_text.map((text, idx) => (
            <div key={idx} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Query {idx + 1}:
                </h4>
                <div className="flex items-center gap-4">
                  <p className="flex-1 text-sm text-white bg-gray-800 dark:bg-gray-700 p-3 rounded-lg" style={getTextDirectionStyles(text)}>
                    {text}
                  </p>
                  <button
                    onClick={() => sendSingleQueryToSearch(idx)}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors text-sm whitespace-nowrap"
                  >
                    <span>Send to Search</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Embedding Boxes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dense Embedding */}
                {response.dense && response.dense[idx] && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 overflow-hidden">
                    <div className="bg-green-100 dark:bg-green-900/40 px-3 py-2 border-b border-green-200 dark:border-green-800 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-green-700 dark:text-green-300">
                          Dense Embedding
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Dimension: {response.dense[idx].length}
                        </div>
                      </div>
                      <button
                        onClick={() => copyDenseEmbedding(idx)}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center gap-1 transition-colors"
                        title="Copy Dense Embedding"
                      >
                        {copiedDense === idx ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedDense === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                        {JSON.stringify(response.dense[idx].slice(0, 50), null, 2)}
                        {response.dense[idx].length > 50 && '\n... (truncated)'}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Sparse Embedding */}
                {response.sparse && response.sparse[idx] && Object.keys(response.sparse[idx]).length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden">
                    <div className="bg-purple-100 dark:bg-purple-900/40 px-3 py-2 border-b border-purple-200 dark:border-purple-800 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                          Sparse Embedding
                        </div>
                        <div className="text-xs text-purple-600 dark:text-purple-400">
                          Terms: {Object.keys(response.sparse[idx]).length}
                        </div>
                      </div>
                      <button
                        onClick={() => copySparseEmbedding(idx)}
                        className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs flex items-center gap-1 transition-colors"
                        title="Copy Sparse Embedding"
                      >
                        {copiedSparse === idx ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedSparse === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 h-48 overflow-y-auto">
                      <pre className="text-xs text-gray-700 dark:text-gray-300 font-mono">
                        {JSON.stringify(response.sparse[idx], null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
