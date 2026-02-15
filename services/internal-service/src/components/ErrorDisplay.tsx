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
    <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-rose-500/10 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-rose-300 mb-1">
            Error {error.status && `(${error.status})`}
          </h3>
          <p className="text-sm text-rose-300/80">
            {error.message || 'An unexpected error occurred'}
          </p>
          {error.data !== undefined && error.data !== null && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-rose-400/60 hover:text-rose-400 transition-colors">
                View details
              </summary>
              <pre className="mt-2 text-xs bg-rose-500/5 border border-rose-500/10 p-3 rounded-lg overflow-x-auto text-rose-300/70">
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
