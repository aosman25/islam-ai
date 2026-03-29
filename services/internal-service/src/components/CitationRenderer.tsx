import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SourceData } from '../types/services';
import { Book, User, Tag, FileText, X, ExternalLink } from 'lucide-react';

interface CitationGroupBadgeProps {
  ids: number[];
  sources: SourceData[];
}

const SourceCard: React.FC<{
  source: SourceData;
  hasDivider: boolean;
  onOpenInViewer: () => void;
}> = ({ source, hasDivider, onOpenInViewer }) => (
  <div className={`space-y-3 ${hasDivider ? 'pt-3 border-t border-slate-700/30' : ''}`} style={{ direction: 'rtl' }}>
    <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
      <span className="font-semibold text-slate-200">{source.book_name}</span>
      <Book className="w-3.5 h-3.5 text-emerald-500/60" />
    </div>
    <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
      <span className="text-slate-400">{source.author}</span>
      <User className="w-3.5 h-3.5 text-slate-600" />
    </div>
    <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
      <span className="text-slate-400">{source.category}</span>
      <Tag className="w-3.5 h-3.5 text-slate-600" />
    </div>
    {source.page_num_range && source.page_num_range.length > 0 && (
      <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
        <span className="text-slate-400">{source.page_num_range.join('-')}</span>
        <FileText className="w-3.5 h-3.5 text-slate-600" />
      </div>
    )}
    {source.book_id && (
      <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
        <span className="text-slate-400">Book ID: {source.book_id}</span>
        <Book className="w-3.5 h-3.5 text-slate-600" />
      </div>
    )}
    {source.start_page_id && (
      <div className="flex items-center gap-2 text-sm flex-row-reverse justify-end">
        <span className="text-slate-400">Page ID: {source.start_page_id}</span>
        <FileText className="w-3.5 h-3.5 text-slate-600" />
      </div>
    )}
    {source.part_title && (
      <div>
        <span className="text-xs bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-600/30">
          {source.part_title}
        </span>
      </div>
    )}
    <div className="bg-slate-800/60 border border-slate-700/30 rounded-lg p-3 max-h-60 overflow-y-auto">
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
        {source.text}
      </p>
    </div>
    <button
      onClick={onOpenInViewer}
      className="flex items-center gap-2 w-full justify-center py-1.5 rounded-lg
                 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20
                 text-emerald-400 text-xs font-medium transition-colors"
      style={{ direction: 'ltr' }}
    >
      <ExternalLink className="w-3.5 h-3.5" />
      Open in Book Viewer
    </button>
  </div>
);

const CitationGroupBadge: React.FC<CitationGroupBadgeProps> = ({ sources }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const label = sources.length > 0
    ? [...new Set(sources.map((s) => s.book_name))].join('، ')
    : '';

  const openInViewer = (source: SourceData) => {
    setOpen(false);
    navigate(`/books/${source.book_id}`, {
      state: {
        scrollToPageId: source.start_page_id,
      },
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 h-5 max-w-[8rem] px-1.5 mx-0.5 text-[10px] font-medium rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-colors cursor-pointer align-middle"
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      </button>
      {open && sources.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md max-h-[80vh] bg-slate-900 border border-slate-700/50 rounded-xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/30 flex-shrink-0">
              <span className="text-xs font-semibold text-slate-400">
                {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3 overflow-y-auto">
              {sources.map((source, i) => (
                <SourceCard
                  key={source.id}
                  source={source}
                  hasDivider={i > 0}
                  onOpenInViewer={() => openInViewer(source)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Regex: matches [number] or [number,number,...] where contents are only digits, commas, and spaces
const CITATION_REGEX = /\[(\d+(?:\s*[,،]\s*\d+)*)\]/g;

// Check if text ends with an incomplete citation bracket during streaming
// e.g. "some text [12" or "some text [12," or "some text [12,3"
const TRAILING_INCOMPLETE_REGEX = /\[\d+(?:\s*[,،]\s*\d+)*(?:\s*[,،]?\s*)?$/;

export function stripIncompleteCitation(text: string): { clean: string; pending: string } {
  const match = text.match(TRAILING_INCOMPLETE_REGEX);
  if (match) {
    return {
      clean: text.slice(0, match.index),
      pending: match[0],
    };
  }
  return { clean: text, pending: '' };
}

interface CitationRendererProps {
  text: string;
  sources: SourceData[];
  isStreaming?: boolean;
}

export const CitationRenderer: React.FC<CitationRendererProps> = ({ text, sources, isStreaming = false }) => {
  const sourceMap = useMemo(() => {
    const map = new Map<number, SourceData>();
    for (const s of sources) {
      map.set(s.id, s);
    }
    return map;
  }, [sources]);

  const processedText = useMemo(() => {
    const input = isStreaming ? stripIncompleteCitation(text).clean : text;

    // Collect all matches first
    const matches = [...input.matchAll(CITATION_REGEX)];
    if (matches.length === 0) return [input];

    // Merge consecutive citations separated only by whitespace/commas/Arabic commas
    const groups: { ids: number[]; start: number; end: number }[] = [];
    for (const match of matches) {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;
      const ids = match[1].split(/[,،]/).map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));

      const last = groups[groups.length - 1];
      if (last) {
        const between = input.slice(last.end, matchStart);
        if (/^[\s,،]*$/.test(between)) {
          // Merge into previous group
          last.ids.push(...ids);
          last.end = matchEnd;
          continue;
        }
      }
      groups.push({ ids, start: matchStart, end: matchEnd });
    }

    // Build output parts
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    for (const group of groups) {
      if (group.start > lastIndex) {
        parts.push(input.slice(lastIndex, group.start));
      }
      const resolved = group.ids.map((id) => sourceMap.get(id)).filter((s): s is SourceData => !!s);
      parts.push(
        <CitationGroupBadge key={`${group.start}`} ids={group.ids} sources={resolved} />
      );
      lastIndex = group.end;
    }
    if (lastIndex < input.length) {
      parts.push(input.slice(lastIndex));
    }

    return parts;
  }, [text, sourceMap, isStreaming]);

  return <>{processedText}</>;
};
