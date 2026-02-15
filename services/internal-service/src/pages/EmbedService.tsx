import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { EmbeddingRequest, EmbeddingResponseModel } from '../types/services';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Plus, Trash2, ArrowRight, Copy, Check, Braces } from 'lucide-react';
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

    const embedding = {
      dense: response.dense ? response.dense[queryIndex] : [],
      sparse: response.sparse ? response.sparse[queryIndex] : {},
      dense_params: { n_probe: 10 },
      sparse_params: { drop_ratio_search: 0.2 }
    };

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
    localStorage.setItem('search-query-text', request.input_text[queryIndex]);
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
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex-shrink-0">
          <Braces className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Embed Service
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate dense, sparse, and ColBERT embeddings for text using DeepInfra API.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">
                Input Texts <span className="text-slate-600">(1-10, max 8000 chars)</span>
              </label>
              <button
                onClick={addText}
                disabled={request.input_text.length >= 10}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Text
              </button>
            </div>

            <div className="space-y-2">
              {request.input_text.map((text, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1">
                    <textarea
                      value={text}
                      onChange={(e) => updateText(idx, e.target.value)}
                      placeholder={idx === 0 ? "What are the pillars of Islam?" : `Text ${idx + 1}...`}
                      className="w-full px-3.5 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-600 transition-all duration-200 text-sm"
                      style={getTextDirectionStyles(text)}
                      rows={2}
                      maxLength={8000}
                    />
                    <p className="text-[10px] text-slate-600 mt-1">
                      {text.length}/8000
                    </p>
                  </div>
                  {request.input_text.length > 1 && (
                    <button
                      onClick={() => removeText(idx)}
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
            disabled={loading || request.input_text.some(t => !t.trim())}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 text-sm shadow-lg shadow-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
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
        <div className="space-y-3">
          {request.input_text.map((text, idx) => (
            <div key={idx} className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5 card-glow">
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Query {idx + 1}
                </h4>
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-sm text-slate-300 bg-slate-800/60 border border-slate-700/30 p-3 rounded-xl" style={getTextDirectionStyles(text)}>
                    {text}
                  </p>
                  <button
                    onClick={() => sendSingleQueryToSearch(idx)}
                    className="px-3 py-2 bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 rounded-xl font-medium flex items-center gap-1.5 transition-all duration-200 text-xs border border-violet-500/20 whitespace-nowrap"
                  >
                    <span>Search</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {response.dense && response.dense[idx] && (
                  <div className="bg-emerald-500/5 rounded-xl border border-emerald-500/15 overflow-hidden">
                    <div className="bg-emerald-500/10 px-3 py-2 border-b border-emerald-500/15 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-emerald-400">Dense</div>
                        <div className="text-[10px] text-emerald-500/60">Dim: {response.dense[idx].length}</div>
                      </div>
                      <button
                        onClick={() => copyDenseEmbedding(idx)}
                        className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-[10px] flex items-center gap-1 transition-colors"
                      >
                        {copiedDense === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedDense === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 h-40 overflow-y-auto">
                      <pre className="text-[10px] text-slate-400 font-mono">
                        {JSON.stringify(response.dense[idx].slice(0, 50), null, 2)}
                        {response.dense[idx].length > 50 && '\n... (truncated)'}
                      </pre>
                    </div>
                  </div>
                )}

                {response.sparse && response.sparse[idx] && Object.keys(response.sparse[idx]).length > 0 && (
                  <div className="bg-purple-500/5 rounded-xl border border-purple-500/15 overflow-hidden">
                    <div className="bg-purple-500/10 px-3 py-2 border-b border-purple-500/15 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-semibold text-purple-400">Sparse</div>
                        <div className="text-[10px] text-purple-500/60">Terms: {Object.keys(response.sparse[idx]).length}</div>
                      </div>
                      <button
                        onClick={() => copySparseEmbedding(idx)}
                        className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-[10px] flex items-center gap-1 transition-colors"
                      >
                        {copiedSparse === idx ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedSparse === idx ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 h-40 overflow-y-auto">
                      <pre className="text-[10px] text-slate-400 font-mono">
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
