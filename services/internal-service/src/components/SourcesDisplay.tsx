import type { SourceData } from '../types/services';
import { Book, User, Tag, FileText } from 'lucide-react';

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

          <div className="space-y-2 mb-3" style={{ direction: 'rtl' }}>
            <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
              <span className="font-semibold text-white">
                {source.book_name}
              </span>
              <Book className="w-4 h-4 text-gray-500" />
            </div>

            <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
              <span className="text-white">
                {source.author}
              </span>
              <User className="w-4 h-4 text-gray-500" />
            </div>

            <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
              <span className="text-white">
                {source.category}
              </span>
              <Tag className="w-4 h-4 text-gray-500" />
            </div>

            {source.page_num_range && source.page_num_range.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-white flex-row-reverse justify-end">
                <span>الصفحات: {source.page_num_range.join('-')}</span>
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
            )}
          </div>

          {source.part_title && (
            <div className="mb-3" style={{ direction: 'rtl' }}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                العنوان الفرعي:
              </div>
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-white px-2 py-1 rounded">
                {source.part_title}
              </span>
            </div>
          )}

          <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded p-3" style={{ direction: 'rtl' }}>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
              النص:
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">
              {source.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
