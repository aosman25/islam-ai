"use client";

import { useState } from "react";
import type { SourceData } from "@/types";
import { cn } from "@/lib/utils";
import { BookOpen, X, ExternalLink } from "lucide-react";

interface CitationRendererProps {
  content: string;
  sources: SourceData[];
}

interface CitationModalProps {
  source: SourceData;
  index: number;
  onClose: () => void;
}

function CitationModal({ source, index, onClose }: CitationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-card rounded-2xl shadow-lg border border-border/60 max-w-lg w-full max-h-[80vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gold-50 text-gold-700 flex items-center justify-center text-sm font-semibold">
              {index + 1}
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-ink-900 leading-tight">
                {source.book_name}
              </h3>
              <p className="text-xs text-ink-500 mt-0.5">{source.author}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-parchment-100 text-ink-400 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[60vh]">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-md bg-parchment-100 text-xs font-medium text-ink-600">
              {source.category}
            </span>
            {source.page_num_range.length > 0 && (
              <span className="px-2.5 py-1 rounded-md bg-gold-50 text-xs font-medium text-gold-700">
                Pages {source.page_num_range.join("-")}
              </span>
            )}
            {source.part_title && (
              <span className="px-2.5 py-1 rounded-md bg-teal-50 text-xs font-medium text-teal-700">
                {source.part_title}
              </span>
            )}
          </div>

          {/* Source text */}
          <div className="prose-arabic bg-parchment-50 rounded-xl p-4 border border-border/40 text-sm">
            {source.text}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-parchment-50/50">
          <a
            href={`/books/${source.book_id}?page=${source.start_page_id}`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gold-600 text-white text-sm font-medium hover:bg-gold-700 transition-colors"
          >
            <ExternalLink size={14} />
            Open in Book Viewer
          </a>
        </div>
      </div>
    </div>
  );
}

export function CitationRenderer({ content, sources }: CitationRendererProps) {
  const [activeSource, setActiveSource] = useState<number | null>(null);

  // Parse citations like [1], [2,3], [1، 2]
  const parts = content.split(/(\[\d+(?:[,،\s]+\d+)*\])/g);

  return (
    <>
      {parts.map((part, i) => {
        const citationMatch = part.match(
          /^\[(\d+(?:[,،\s]+\d+)*)\]$/
        );
        if (citationMatch) {
          const indices = citationMatch[1]
            .split(/[,،\s]+/)
            .map((n) => parseInt(n, 10) - 1)
            .filter((n) => n >= 0 && n < sources.length);

          return (
            <span key={i} className="inline-flex gap-0.5">
              {indices.map((idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveSource(idx)}
                  className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded bg-gold-100 text-gold-700 text-[10px] font-bold hover:bg-gold-200 transition-colors cursor-pointer align-super leading-none"
                  title={sources[idx]?.book_name}
                >
                  {idx + 1}
                </button>
              ))}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}

      {/* Citation Modal */}
      {activeSource !== null && sources[activeSource] && (
        <CitationModal
          source={sources[activeSource]}
          index={activeSource}
          onClose={() => setActiveSource(null)}
        />
      )}
    </>
  );
}

// Sources panel shown below a message
export function SourcesPanel({ sources }: { sources: SourceData[] }) {
  const [expanded, setExpanded] = useState(false);
  const [activeSource, setActiveSource] = useState<number | null>(null);

  if (sources.length === 0) return null;

  const shown = expanded ? sources : sources.slice(0, 3);

  return (
    <>
      <div className="mt-4 pt-4 border-t border-border/40">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs font-medium text-ink-500 hover:text-gold-700 transition-colors mb-3"
        >
          <BookOpen size={13} />
          {sources.length} Source{sources.length !== 1 ? "s" : ""}
          {!expanded && sources.length > 3 && (
            <span className="text-ink-400">
              &middot; Show all
            </span>
          )}
        </button>
        <div className="space-y-2">
          {shown.map((source, i) => (
            <button
              key={i}
              onClick={() => setActiveSource(i)}
              className={cn(
                "w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-parchment-50/50",
                "hover:border-gold-200 hover:bg-gold-50/30 transition-all duration-200 group"
              )}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded bg-gold-100 text-gold-700 text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-800 truncate">
                  {source.book_name}
                </p>
                <p className="text-xs text-ink-400 mt-0.5">
                  {source.author}
                  {source.page_num_range.length > 0 &&
                    ` · p. ${source.page_num_range.join("-")}`}
                </p>
              </div>
              <ExternalLink
                size={12}
                className="flex-shrink-0 text-ink-300 group-hover:text-gold-500 mt-1 transition-colors"
              />
            </button>
          ))}
        </div>
      </div>

      {activeSource !== null && sources[activeSource] && (
        <CitationModal
          source={sources[activeSource]}
          index={activeSource}
          onClose={() => setActiveSource(null)}
        />
      )}
    </>
  );
}
