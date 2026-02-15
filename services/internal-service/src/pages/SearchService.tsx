import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { SearchRequest, SearchBatchResponse } from '../types/services';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { SourcesDisplay } from '../components/SourcesDisplay';
import { Play, ArrowRight, Search } from 'lucide-react';
import { usePersistedState } from '../hooks/usePersistedState';

export const SearchService: React.FC = () => {
  const navigate = useNavigate();
  const [partitions, setPartitions] = useState<string[]>([]);
  const [request, setRequest] = usePersistedState<SearchRequest>('search-request', {
    k: 20,
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
    output_fields: ['id', 'book_id', 'book_name', 'author', 'text', 'category', 'part_title', 'start_page_id', 'page_offset', 'page_num_range', 'order']
  });

  const [response, setResponse] = usePersistedState<SearchBatchResponse | null>('search-response', null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<'results' | 'raw'>('search-active-tab', 'results');

  useEffect(() => {
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

    const queryText = localStorage.getItem('search-query-text');
    const query = queryText || 'Please provide a detailed answer based on these sources';

    const askRequest = {
      query,
      sources: response.results,
      temperature: 0.2,
      max_tokens: 12000,
      stream: true,
    };
    localStorage.setItem('ask-request', JSON.stringify(askRequest));
    navigate('/ask');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex-shrink-0">
          <Search className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Search Service
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Hybrid vector search using Milvus database with dense and sparse embeddings.
          </p>
        </div>
      </div>

      <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              K <span className="text-slate-600">(Top results: 1-100)</span>
            </label>
            <input
              type="number"
              value={request.k}
              onChange={(e) => setRequest({ ...request, k: parseInt(e.target.value) })}
              min={1}
              max={100}
              className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Dense Embedding <span className="text-slate-600">(comma-separated floats)</span>
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
              className="w-full px-3.5 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-600 font-mono text-xs"
              rows={3}
            />
            <p className="text-[10px] text-slate-600 mt-1">
              Dimension: {request.embeddings[0]?.dense.length || 0}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Sparse Embedding <span className="text-slate-600">(JSON: {'{'}index: value{'}'})</span>
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
              className="w-full px-3.5 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-600 font-mono text-xs"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Reranker</label>
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
                className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
              >
                <option value="Weighted">Weighted</option>
                <option value="RRF">RRF</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Collection</label>
              <input
                type="text"
                value={request.collection_name}
                onChange={(e) => setRequest({ ...request, collection_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
              />
            </div>
          </div>

          {/* Dynamic Reranker Params */}
          {request.reranker === 'Weighted' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Dense Weight</label>
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
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Sparse Weight</label>
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
                  className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">RRF K Value</label>
              <input
                type="number"
                value={Array.isArray(request.reranker_params) ? (request.reranker_params[0] ?? 60) : 60}
                onChange={(e) => {
                  setRequest({ ...request, reranker_params: [parseInt(e.target.value)] });
                }}
                min={1}
                max={16384}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Partitions <span className="text-slate-600">(optional)</span>
            </label>
            <select
              multiple
              value={request.partition_names}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setRequest({ ...request, partition_names: selected });
              }}
              className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
              size={Math.min(5, partitions.length)}
            >
              {partitions.map(partition => (
                <option key={partition} value={partition}>{partition}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-600 mt-1">
              Hold Ctrl/Cmd to select multiple
            </p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || request.embeddings[0]?.dense.length === 0}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 text-sm shadow-lg shadow-violet-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none"
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
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
          <div className="border-b border-slate-700/30">
            <div className="flex items-center justify-between p-2">
              <div className="flex gap-1">
                {['results', 'raw'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as typeof activeTab)}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      activeTab === tab
                        ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={sendToAskService}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg font-medium flex items-center gap-1.5 transition-all duration-200 text-xs border border-emerald-500/20"
              >
                <span>Send to Ask</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'results' && (
              <div>
                <div className="mb-3 text-xs text-slate-500">
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
