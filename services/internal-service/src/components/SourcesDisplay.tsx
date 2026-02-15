import type { SourceData } from '../types/services';
import { Book, User, Tag, FileText } from 'lucide-react';

interface SourcesDisplayProps {
  sources: SourceData[];
}

export const SourcesDisplay: React.FC<SourcesDisplayProps> = ({ sources }) => {
  if (sources.length === 0) {
    return (
      <div className="text-sm text-slate-500 text-center py-8">
        No sources available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sources.map((source, index) => (
        <div
          key={source.id}
          className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 card-glow transition-all duration-200"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                #{index + 1}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                {source.distance.toFixed(4)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 mb-3" style={{ direction: 'rtl' }}>
            <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
              <span className="font-semibold text-slate-200">
                {source.book_name}
              </span>
              <Book className="w-3.5 h-3.5 text-emerald-500/60" />
            </div>

            <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
              <span className="text-slate-400">
                {source.author}
              </span>
              <User className="w-3.5 h-3.5 text-slate-600" />
            </div>

            <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
              <span className="text-slate-400">
                {source.category}
              </span>
              <Tag className="w-3.5 h-3.5 text-slate-600" />
            </div>

            {source.page_num_range && source.page_num_range.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-slate-400 flex-row-reverse justify-end">
                <span>{source.page_num_range.join('-')}</span>
                <FileText className="w-3.5 h-3.5 text-slate-600" />
              </div>
            )}
          </div>

          {source.part_title && (
            <div className="mb-3" style={{ direction: 'rtl' }}>
              <span className="text-xs bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-600/30">
                {source.part_title}
              </span>
            </div>
          )}

          <div className="bg-slate-900/50 border border-slate-700/30 rounded-lg p-3" style={{ direction: 'rtl' }}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
              {source.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
