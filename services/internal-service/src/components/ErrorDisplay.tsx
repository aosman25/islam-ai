import { AlertCircle } from 'lucide-react';

interface ErrorDisplayProps {
  error: {
    message?: string;
    status?: number;
    data?: unknown;
  };
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error }) => {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">
            Error {error.status && `(${error.status})`}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">
            {error.message || 'An unexpected error occurred'}
          </p>
          {error.data !== undefined && error.data !== null && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-red-600 dark:text-red-400 hover:underline">
                View details
              </summary>
              <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-2 rounded overflow-x-auto">
                <code>
                  {(() => {
                    try {
                      return typeof error.data === 'string' ? error.data : JSON.stringify(error.data, null, 2);
                    } catch {
                      return String(error.data);
                    }
                  })()}
                </code>
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};
