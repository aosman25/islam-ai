import { useState } from 'react';
import { apiService } from '../services/api';
import type { AskRequest, AskResponse, SourceData } from '../types/services';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Square, Plus, Trash2 } from 'lucide-react';
import { getTextDirection, getTextDirectionStyles } from '../utils/textDirection';
import { usePersistedState } from '../hooks/usePersistedState';

export const AskService: React.FC = () => {
  const [request, setRequest] = usePersistedState<AskRequest>('ask-request', {
    query: '',
    sources: [],
    temperature: 0.2,
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
      id: `source_${Date.now()}`,
      book_id: 'book_1',
      book_name: 'Example Book',
      order: request.sources.length + 1,
      author: 'Author Name',
      knowledge: 'Islamic Knowledge',
      category: 'Fiqh',
      header_titles: ['Chapter 1'],
      page_range: [1, 10],
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
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Ask Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test LLM response generation using Google Gemini with provided sources.
        </p>
      </div>

      {/* Request Form */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Request Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Query
            </label>
            <textarea
              value={request.query}
              onChange={(e) => setRequest({ ...request, query: e.target.value })}
              placeholder="What are the pillars of Islam?"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              style={getTextDirectionStyles(request.query)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>

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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sources ({request.sources.length})
              </label>
              <button
                onClick={addSource}
                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus className="w-4 h-4" />
                Add Source
              </button>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
              {request.sources.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  No sources added yet. Click "Add Source" to add one.
                </p>
              ) : (
                request.sources.map((source, idx) => (
                  <div key={idx} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Source {idx + 1}</span>
                      <button
                        onClick={() => removeSource(idx)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        placeholder="Book Name"
                        value={source.book_name}
                        onChange={(e) => updateSource(idx, 'book_name', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        style={getTextDirectionStyles(source.book_name)}
                      />
                      <input
                        placeholder="Author"
                        value={source.author}
                        onChange={(e) => updateSource(idx, 'author', e.target.value)}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        style={getTextDirectionStyles(source.author)}
                      />
                    </div>
                    <textarea
                      placeholder="Source text content..."
                      value={source.text}
                      onChange={(e) => updateSource(idx, 'text', e.target.value)}
                      className="w-full mt-2 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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
                <span>Generate Response</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}

      {(response || streaming || streamingText) && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-1 p-2">
              {['response', 'raw'].map((tab) => (
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
                {streaming && !streamingText && (
                  <div className="mb-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
                    <LoadingSpinner size="sm" />
                    <span>Generating response from {request.sources.length} sources...</span>
                  </div>
                )}
                {streaming && streamingText && (
                  <div className="mb-2 text-sm text-blue-600 dark:text-blue-400">Streaming...</div>
                )}
                <MarkdownRenderer content={response?.response || streamingText} />
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
