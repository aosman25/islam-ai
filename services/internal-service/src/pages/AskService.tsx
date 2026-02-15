import { useState } from 'react';
import { apiService } from '../services/api';
import type { AskRequest, AskResponse, SourceData } from '../types/services';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Square, Plus, Trash2, MessageSquare } from 'lucide-react';
import { getTextDirectionStyles } from '../utils/textDirection';
import { usePersistedState } from '../hooks/usePersistedState';

export const AskService: React.FC = () => {
  const [request, setRequest] = usePersistedState<AskRequest>('ask-request', {
    query: '',
    sources: [],
    temperature: 1,
    max_tokens: 12000,
    stream: true,
  });

  const [response, setResponse] = usePersistedState<AskResponse | null>('ask-response', null);
  const [streamingText, setStreamingText] = usePersistedState<string>('ask-streaming-text', '');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<'response' | 'raw'>('ask-active-tab', 'response');

  const addSource = () => {
    const newSource: SourceData = {
      distance: 0.5,
      id: Date.now(),
      book_id: 1,
      book_name: 'Example Book',
      order: request.sources.length + 1,
      author: 'Author Name',
      category: 'Fiqh',
      part_title: 'Chapter 1',
      start_page_id: 1,
      page_offset: 0,
      page_num_range: [1, 10],
      text: 'Enter source text here...',
    };
    setRequest({ ...request, sources: [...request.sources, newSource] });
  };

  const removeSource = (index: number) => {
    const newSources = request.sources.filter((_, idx) => idx !== index);
    setRequest({ ...request, sources: newSources });
  };

  const updateSource = (index: number, field: keyof SourceData, value: unknown) => {
    const newSources = [...request.sources];
    (newSources[index] as SourceData)[field] = value as never;
    setRequest({ ...request, sources: newSources });
  };

  const handleSubmit = async () => {
    setError(null);
    setResponse(null);
    setStreamingText('');

    if (request.stream) {
      setStreaming(true);
      await apiService.askQueryStream(
        request,
        (text: string) => {
          setStreamingText((prev) => prev + text);
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
        const result = await apiService.askQuery(request);
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
      {/* Page Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex-shrink-0">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">
            Ask Service
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Test LLM response generation using Google Gemini with provided sources.
          </p>
        </div>
      </div>

      {/* Request Form */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 p-5">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Query</label>
            <textarea
              value={request.query}
              onChange={(e) => setRequest({ ...request, query: e.target.value })}
              placeholder="What are the pillars of Islam?"
              className="w-full px-3.5 py-2.5 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 placeholder-slate-600 transition-all duration-200"
              style={getTextDirectionStyles(request.query)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Temperature</label>
              <input
                type="number"
                value={request.temperature}
                onChange={(e) => setRequest({ ...request, temperature: parseFloat(e.target.value) })}
                min={0}
                max={2}
                step={0.1}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Max Tokens</label>
              <input
                type="number"
                value={request.max_tokens}
                onChange={(e) => setRequest({ ...request, max_tokens: parseInt(e.target.value) })}
                min={1}
                max={65536}
                className="w-full px-3 py-2 border border-slate-700/50 rounded-xl bg-slate-800/50 text-slate-200 text-sm"
              />
            </div>
          </div>

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-400">
                Sources <span className="text-slate-600">({request.sources.length})</span>
              </label>
              <button
                onClick={addSource}
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Source
              </button>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto border border-slate-700/30 rounded-xl p-3 bg-slate-800/20">
              {request.sources.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-6">
                  No sources added yet. Click "Add Source" to add one.
                </p>
              ) : (
                request.sources.map((source, idx) => (
                  <div key={idx} className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/30">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-slate-400">Source {idx + 1}</span>
                      <button
                        onClick={() => removeSource(idx)}
                        className="text-rose-400/60 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        placeholder="Book Name"
                        value={source.book_name}
                        onChange={(e) => updateSource(idx, 'book_name', e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-700/50 rounded-lg bg-slate-900/50 text-slate-200 placeholder-slate-600"
                        style={getTextDirectionStyles(source.book_name)}
                      />
                      <input
                        placeholder="Author"
                        value={source.author}
                        onChange={(e) => updateSource(idx, 'author', e.target.value)}
                        className="px-2.5 py-1.5 text-xs border border-slate-700/50 rounded-lg bg-slate-900/50 text-slate-200 placeholder-slate-600"
                        style={getTextDirectionStyles(source.author)}
                      />
                    </div>
                    <textarea
                      placeholder="Source text content..."
                      value={source.text}
                      onChange={(e) => updateSource(idx, 'text', e.target.value)}
                      className="w-full mt-2 px-2.5 py-1.5 text-xs border border-slate-700/50 rounded-lg bg-slate-900/50 text-slate-200 placeholder-slate-600"
                      style={getTextDirectionStyles(source.text)}
                      rows={3}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={streaming ? handleStop : handleSubmit}
            disabled={loading || !request.query.trim()}
            className={`w-full px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-200 text-sm ${
              streaming
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30'
                : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none'
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
                <span>Generate Response</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      {(response || streaming || streamingText) && (
        <div className="bg-slate-900/50 rounded-xl border border-slate-700/30 overflow-hidden">
          <div className="border-b border-slate-700/30">
            <div className="flex gap-1 p-2">
              {['response', 'raw'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    activeTab === tab
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {activeTab === 'response' && (
              <div>
                {streaming && !streamingText && (
                  <div className="mb-4 flex items-center gap-2 text-sm shimmer-bg rounded-lg px-3 py-2">
                    <LoadingSpinner size="sm" />
                    <span className="text-cyan-400">Generating response from {request.sources.length} sources...</span>
                  </div>
                )}
                {streaming && streamingText && (
                  <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    Streaming...
                  </div>
                )}
                <MarkdownRenderer
                  content={response?.response || streamingText}
                  isStreaming={streaming && !!streamingText}
                />
              </div>
            )}

            {activeTab === 'raw' && (
              <JsonViewer data={response || { streamingText }} title="Raw Response" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
