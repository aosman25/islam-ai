import { useState } from 'react';
import { apiService } from '../services/api';
import type { GatewayRequest, GatewayResponse, GatewayStreamChunk, SourceData } from '../types/services';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { SourcesDisplay } from '../components/SourcesDisplay';
import { Play, Square, Database, ChevronDown, Settings, Maximize2, X, Copy, Check } from 'lucide-react';
import { useEffect } from 'react';
import { getTextDirectionStyles } from '../utils/textDirection';
import { usePersistedState } from '../hooks/usePersistedState';

export const GatewayService: React.FC = () => {
  const [request, setRequest] = usePersistedState<GatewayRequest>('gateway-request', {
    query: '',
    top_k: 20,
    temperature: 1,
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
    categories: string[];
    request_id: string;
  } | null>('gateway-stream-metadata', null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<'response' | 'sources' | 'metadata' | 'raw'>('gateway-active-tab', 'response');

  const handleCopy = async () => {
    const text = response?.response || streamingText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setReaderOpen(false);
    };
    if (readerOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [readerOpen]);

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
              categories: chunk.categories || [],
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
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
          <Database className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Gateway Service
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete RAG pipeline with query optimization, embedding, search, and LLM generation.
          </p>
        </div>
      </div>

      {/* Error Display */}
      {error && <ErrorDisplay error={error} />}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(280px,360px)_1fr] gap-5 items-start">
        {/* Left: Request Form */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5 md:sticky md:top-[75px]">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Request Configuration</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Query <span className="text-slate-600">(1-1000)</span>
              </label>
              <textarea
                value={request.query}
                onChange={(e) => setRequest({ ...request, query: e.target.value })}
                placeholder="What are the pillars of Islam?"
                className="w-full px-3.5 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-600 transition-all duration-200 text-sm"
                style={getTextDirectionStyles(request.query)}
                rows={3}
                maxLength={1000}
              />
              <p className="text-[10px] text-slate-600 mt-1">
                {request.query.length}/1000
              </p>
            </div>

            {/* Settings Toggle */}
            <div>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-300 hover:bg-slate-800/40 transition-all duration-200"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Parameters</span>
                <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
              </button>

              <div className={`grid transition-all duration-300 ease-out ${settingsOpen ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Top K</label>
                      <input
                        type="number"
                        value={request.top_k}
                        onChange={(e) => setRequest({ ...request, top_k: parseInt(e.target.value) })}
                        min={1}
                        max={100}
                        className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Temperature</label>
                      <input
                        type="number"
                        value={request.temperature}
                        onChange={(e) => setRequest({ ...request, temperature: parseFloat(e.target.value) })}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Max Tokens</label>
                      <input
                        type="number"
                        value={request.max_tokens}
                        onChange={(e) => setRequest({ ...request, max_tokens: parseInt(e.target.value) })}
                        min={1}
                        max={65536}
                        className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Reranker</label>
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
                        className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                      >
                        <option value="Weighted">Weighted</option>
                        <option value="RRF">RRF</option>
                      </select>
                    </div>
                  </div>

                  {/* Dynamic Reranker Params */}
                  {request.reranker === 'Weighted' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Dense Weight</label>
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
                          className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Sparse Weight</label>
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
                          className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">RRF K Value</label>
                      <input
                        type="number"
                        value={Array.isArray(request.reranker_params) ? (request.reranker_params[0] ?? 60) : 60}
                        onChange={(e) => {
                          setRequest({ ...request, reranker_params: [parseInt(e.target.value)] });
                        }}
                        min={1}
                        max={16384}
                        className="w-full px-3 py-1.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={request.stream}
                      onChange={(e) => setRequest({ ...request, stream: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500/30"
                    />
                    <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                      Enable Streaming
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <button
              onClick={streaming ? handleStop : handleSubmit}
              disabled={loading || !request.query.trim()}
              className={`w-full px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 text-sm ${
                streaming
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                  : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none'
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

        {/* Right: Response Display */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden min-h-[400px]">
          {/* Tabs */}
          <div className="border-b border-slate-700/30">
            <div className="flex items-center gap-1 p-2">
              {['response', 'sources', 'metadata', 'raw'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              {(response || streamingText) && (
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={handleCopy}
                    className={`p-1.5 rounded-lg transition-all duration-200 ${
                      copied
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
                    }`}
                    title={copied ? 'Copied!' : 'Copy response'}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setReaderOpen(true)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 transition-all duration-200"
                    title="Open in reader"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="p-5">
            {!response && !streaming && !streamingText && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                <Database className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">Execute a query to see results</p>
              </div>
            )}

            {activeTab === 'response' && (response || streaming || streamingText) && (
              <div>
                {streaming && !streamingText && !streamMetadata && (
                  <div className="flex flex-col items-center justify-center py-10 gap-3">
                    <LoadingSpinner size="md" />
                    <span className="text-sm text-emerald-400">Optimizing queries & searching sources...</span>
                    <div className="flex gap-1 mt-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                )}
                {streaming && !streamingText && streamMetadata && (
                  <div className="mb-4 flex items-center gap-2 text-sm shimmer-bg rounded-lg px-3 py-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-emerald-400">Generating response from {streamMetadata.sources.length} sources...</span>
                  </div>
                )}
                {streaming && streamingText && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Streaming...
                  </div>
                )}
                <MarkdownRenderer
                  content={response?.response || streamingText}
                  isStreaming={streaming && !!streamingText}
                />
              </div>
            )}

            {activeTab === 'sources' && (response || streamMetadata) && (
              <SourcesDisplay sources={response?.sources || streamMetadata?.sources || []} />
            )}

            {activeTab === 'metadata' && (response || streamMetadata) && (
              <div className="space-y-5">
                {(response?.hypothetical_passages || streamMetadata?.hypothetical_passages || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Hypothetical Passages (HyDE)
                    </h4>
                    <div className="space-y-2">
                      {(response?.hypothetical_passages || streamMetadata?.hypothetical_passages || []).map((passage, idx) => (
                        <p
                          key={idx}
                          className="text-sm bg-blue-500/5 border border-blue-500/15 px-4 py-2.5 rounded-xl text-slate-300"
                          style={getTextDirectionStyles(passage)}
                        >
                          {passage}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {(response?.categories || streamMetadata?.categories || []).length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Categories
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {(response?.categories || streamMetadata?.categories || []).map((category, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20"
                          style={getTextDirectionStyles(category)}
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Request ID
                  </h4>
                  <p className="text-sm font-mono text-slate-400 bg-slate-800/60 border border-slate-700/30 p-3 rounded-xl">
                    {response?.request_id || streamMetadata?.request_id}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'raw' && (response || streamingText) && (
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
      </div>

      {/* Reader Modal */}
      {readerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          onClick={() => setReaderOpen(false)}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/30 flex-shrink-0">
              <h3 className="text-sm font-semibold text-slate-300">Response Reader</h3>
              <button
                onClick={() => setReaderOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <MarkdownRenderer
                content={response?.response || streamingText}
                isStreaming={streaming && !!streamingText}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
