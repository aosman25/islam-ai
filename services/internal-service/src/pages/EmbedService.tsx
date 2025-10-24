import { useState } from 'react';
import { apiService } from '../services/api';
import type { EmbeddingRequest, EmbeddingResponseModel } from '../types/services';
import { JsonViewer } from '../components/JsonViewer';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { Play, Plus, Trash2 } from 'lucide-react';
import { getTextDirection, getTextDirectionStyles } from '../utils/textDirection';

export const EmbedService: React.FC = () => {
  const [request, setRequest] = useState<EmbeddingRequest>({
    input_text: [''],
    dense: true,
    sparse: true,
    colbert: false,
  });

  const [response, setResponse] = useState<EmbeddingResponseModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message?: string; status?: number; data?: unknown } | null>(null);

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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Embedding Types
            </label>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dense"
                checked={request.dense}
                onChange={(e) => setRequest({ ...request, dense: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="dense" className="text-sm text-gray-700 dark:text-gray-300">
                Dense Embeddings (recommended for semantic search)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="sparse"
                checked={request.sparse}
                onChange={(e) => setRequest({ ...request, sparse: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="sparse" className="text-sm text-gray-700 dark:text-gray-300">
                Sparse Embeddings (term-based matching)
              </label>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="colbert"
                checked={request.colbert}
                onChange={(e) => setRequest({ ...request, colbert: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="colbert" className="text-sm text-gray-700 dark:text-gray-300">
                ColBERT Embeddings (contextualized late interaction)
              </label>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || request.input_text.some(t => !t.trim()) || (!request.dense && !request.sparse && !request.colbert)}
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
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
            Embeddings Result
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Processed Count</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{response.processed_count}</div>
              </div>

              {response.dense && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Dense Dimension</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {response.dense[0]?.length || 0}
                  </div>
                </div>
              )}

              {response.sparse && (
                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Sparse Terms</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Object.keys(response.sparse[0] || {}).length}
                  </div>
                </div>
              )}
            </div>

            <JsonViewer data={response} title="Full Response" />
          </div>
        </div>
      )}
    </div>
  );
};
