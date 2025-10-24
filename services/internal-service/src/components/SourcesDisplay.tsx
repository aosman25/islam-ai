import type { SourceData } from '../types/services';
import { Book, User, Tag, FileText } from 'lucide-react';
import { getTextDirection, getTextDirectionStyles } from '../utils/textDirection';

interface SourcesDisplayProps {
  sources: SourceData[];
}

export const SourcesDisplay: React.FC<SourcesDisplayProps> = ({ sources }) => {
  if (sources.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
        No sources available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sources.map((source, index) => (
        <div
          key={source.id}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                Source {index + 1}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Score: {source.distance.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2 text-sm">
              <Book className="w-4 h-4 text-gray-500" />
              <span
                className={`font-semibold text-white ${getTextDirection(source.book_name) === 'rtl' ? 'rtl' : ''}`}
                style={getTextDirectionStyles(source.book_name)}
              >
                {source.book_name}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-gray-500" />
              <span
                className={`text-white ${getTextDirection(source.author) === 'rtl' ? 'rtl' : ''}`}
                style={getTextDirectionStyles(source.author)}
              >
                {source.author}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Tag className="w-4 h-4 text-gray-500" />
              <span
                className={`text-white ${getTextDirection(`${source.category} - ${source.knowledge}`) === 'rtl' ? 'rtl' : ''}`}
                style={getTextDirectionStyles(`${source.category} - ${source.knowledge}`)}
              >
                {source.category} - {source.knowledge}
              </span>
            </div>

            {source.page_range && source.page_range.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-white">
                <FileText className="w-4 h-4 text-gray-500" />
                <span>Pages: {source.page_range.join('-')}</span>
              </div>
            )}
          </div>

          {source.header_titles && source.header_titles.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                Headers:
              </div>
              <div className="flex flex-wrap gap-1">
                {source.header_titles.map((header, idx) => (
                  <span
                    key={idx}
                    className={`text-xs bg-gray-100 dark:bg-gray-700 text-white px-2 py-1 rounded ${getTextDirection(header) === 'rtl' ? 'rtl' : ''}`}
                    style={getTextDirectionStyles(header)}
                  >
                    {header}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              Text Content:
            </div>
            <p
              className={`text-sm leading-relaxed whitespace-pre-wrap text-white ${getTextDirection(source.text) === 'rtl' ? 'rtl' : ''}`}
              style={getTextDirectionStyles(source.text)}
            >
              {source.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
