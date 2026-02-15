import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { QueryRequest, QueryResponse } from '../types/services';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Plus, Trash2, ArrowRight, Sparkles } from 'lucide-react';
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

    const passages: string[] = [];
    response.results.forEach(result => {
      passages.push(...result.hypothetical_passages);
    });

    const embedRequest = {
      input_text: passages,
      dense: true,
      sparse: false,
      colbert: false,
    };
    localStorage.setItem('embed-request', JSON.stringify(embedRequest));
    navigate('/embed');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex-shrink-0">
          <Sparkles className="w-5 h-5 text-rose-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Query Optimizer
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Optimize queries and generate sub-queries using Google Gemini for better search coverage.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">
                Queries <span className="text-slate-600">(1-10, max 1000 chars)</span>
              </label>
              <button
                onClick={addQuery}
                disabled={request.queries.length >= 10}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Query
              </button>
            </div>

            <div className="space-y-2">
              {request.queries.map((query, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1">
                    <textarea
                      value={query}
                      onChange={(e) => updateQuery(idx, e.target.value)}
                      placeholder={idx === 0 ? "What are the pillars of Islam?" : `Query ${idx + 1}...`}
                      className="w-full px-3.5 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-600 transition-all duration-200 text-sm"
                      style={getTextDirectionStyles(query)}
                      rows={2}
                      maxLength={1000}
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                      {query.length}/1000
                    </p>
                  </div>
                  {request.queries.length > 1 && (
                    <button
                      onClick={() => removeQuery(idx)}
                      className="text-rose-400/60 hover:text-rose-400 transition-colors p-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || request.queries.some(q => !q.trim())}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 text-sm shadow-lg shadow-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
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
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Results ({response.processed_count} queries)
            </h3>
            <button
              onClick={sendToEmbedService}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg font-medium flex items-center gap-1.5 transition-all duration-200 text-xs border border-amber-500/20"
            >
              <span>Send to Embed</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-4">
            {response.results.map((result, idx) => (
              <div key={idx} className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/30">
                <div className="mb-3">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Original Query {idx + 1}
                  </h4>
                  <p
                    className={`text-sm bg-slate-900/60 border border-slate-700/30 p-3 rounded-xl text-slate-300 ${getTextDirection(request.queries[idx]) === 'rtl' ? 'rtl' : ''}`}
                    style={getTextDirectionStyles(request.queries[idx])}
                  >
                    {request.queries[idx]}
                  </p>
                </div>

                {result.hypothetical_passages && result.hypothetical_passages.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-blue-400 mb-2">
                      Hypothetical Passages ({result.hypothetical_passages.length})
                    </h4>
                    <div className="space-y-2">
                      {result.hypothetical_passages.map((passage, pIdx) => (
                        <p
                          key={pIdx}
                          className="text-sm bg-blue-500/5 border border-blue-500/15 px-4 py-2.5 rounded-xl text-slate-300"
                          style={getTextDirectionStyles(passage)}
                        >
                          {passage}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {result.categories && result.categories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-purple-400 mb-2">
                      Categories ({result.categories.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5" style={{ direction: 'rtl' }}>
                      {result.categories.map((category, catIdx) => (
                        <span
                          key={catIdx}
                          className="text-xs bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/20"
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

          <div className="mt-5">
            <JsonViewer data={response} title="Raw Response" />
          </div>
        </div>
      )}
    </div>
  );
};
