import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { QueryRequest, QueryResponse } from '../types/services';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Plus, Trash2, ArrowRight } from 'lucide-react';
import { getTextDirection, getTextDirectionStyles } from '../utils/textDirection';
import { usePersistedState } from '../hooks/usePersistedState';

export const QueryOptimizerService: React.FC = () => {
  const navigate = useNavigate();
  const [request, setRequest] = usePersistedState<QueryRequest>('query-optimizer-request', {
    queries: [''],
  });

  const [response, setResponse] = usePersistedState<QueryResponse | null>('query-optimizer-response', null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);

  const addQuery = () => {
    if (request.queries.length < 10) {
      setRequest({ ...request, queries: [...request.queries, ''] });
    }
  };

  const removeQuery = (index: number) => {
    const newQueries = request.queries.filter((_, idx) => idx !== index);
    setRequest({ ...request, queries: newQueries });
  };

  const updateQuery = (index: number, value: string) => {
    const newQueries = [...request.queries];
    newQueries[index] = value;
    setRequest({ ...request, queries: newQueries });
  };

  const handleSubmit = async () => {
    setError(null);
    setResponse(null);
    setLoading(true);

    try {
      const result = await apiService.optimizeQueries(request);
      setResponse(result);
    } catch (err: unknown) {
      setError(err as { message?: string; status?: number; data?: unknown });
    } finally {
      setLoading(false);
    }
  };

  const sendToEmbedService = () => {
    if (!response || response.results.length === 0) return;

    // Get all keywords from results
    const textsToEmbed: string[] = [];
    response.results.forEach(result => {
      textsToEmbed.push(...result.keywords);
    });

    // Update embed service request in localStorage
    const embedRequest = {
      input_text: textsToEmbed,
      dense: true,
      sparse: true,
      colbert: false,
    };
    localStorage.setItem('embed-request', JSON.stringify(embedRequest));

    // Navigate to embed service
    navigate('/embed');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Query Optimizer Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Optimize queries and generate sub-queries using Google Gemini for better search coverage.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Queries (1-10 queries, max 1000 chars each)
              </label>
              <button
                onClick={addQuery}
                disabled={request.queries.length >= 10}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Query
              </button>
            </div>

            <div className="space-y-3">
              {request.queries.map((query, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1">
                    <textarea
                      value={query}
                      onChange={(e) => updateQuery(idx, e.target.value)}
                      placeholder={idx === 0 ? "What are the pillars of Islam?" : `Query ${idx + 1}...`}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      style={getTextDirectionStyles(query)}
                      rows={2}
                      maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {query.length}/1000 characters
                    </p>
                  </div>
                  {request.queries.length > 1 && (
                    <button
                      onClick={() => removeQuery(idx)}
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
            disabled={loading || request.queries.some(q => !q.trim())}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Optimizing Queries...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Optimize Queries</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      {response && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Optimization Results ({response.processed_count} queries)
            </h3>
            <button
              onClick={sendToEmbedService}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <span>Send to Embed Service</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-6">
            {response.results.map((result, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="mb-3">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Original Query {idx + 1}:
                  </h4>
                  <p
                    className={`text-sm bg-white dark:bg-gray-900 p-3 rounded border border-gray-200 dark:border-gray-700 text-white ${getTextDirection(request.queries[idx]) === 'rtl' ? 'rtl' : ''}`}
                    style={getTextDirectionStyles(request.queries[idx])}
                  >
                    {request.queries[idx]}
                  </p>
                </div>

                {result.keywords && result.keywords.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                      Keywords ({result.keywords.length}):
                    </h4>
                    <div className="flex flex-wrap gap-2" style={{ direction: 'rtl' }}>
                      {result.keywords.map((keyword, kwIdx) => (
                        <span
                          key={kwIdx}
                          className="text-sm bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full border border-green-200 dark:border-green-800 text-white"
                          style={getTextDirectionStyles(keyword)}
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {result.categories && result.categories.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-2">
                      Selected Categories ({result.categories.length}):
                    </h4>
                    <div className="flex flex-wrap gap-2" style={{ direction: 'rtl' }}>
                      {result.categories.map((category, catIdx) => (
                        <span
                          key={catIdx}
                          className="text-sm bg-purple-50 dark:bg-purple-900/20 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-6">
            <JsonViewer data={response} title="Raw Response" />
          </div>
        </div>
      )}
    </div>
  );
};
