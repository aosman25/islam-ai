"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import type { SourceData } from "@/types";
import { cn } from "@/lib/utils";
import { BookOpen, X, ExternalLink } from "lucide-react";
import Link from "next/link";

// ============================================================
// Regex patterns
// ============================================================

const CITATION_REGEX = /\[(\d+(?:\s*[,،]\s*\d+)*)\]/g;
const TRAILING_INCOMPLETE_REGEX =
  /\[\d+(?:\s*[,،]\s*\d+)*(?:\s*[,،]?\s*)?$/;

export function stripIncompleteCitation(text: string): string {
  const match = text.match(TRAILING_INCOMPLETE_REGEX);
  if (match) {
    return text.slice(0, match.index);
  }
  return text;
}

// ============================================================
// Citation Overlay (portalled to body, centered on page)
// ============================================================

function CitationOverlay({
  sources,
  onClose,
}: {
  sources: SourceData[];
  onClose: () => void;
}) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg max-h-[80vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <span className="text-sm font-semibold text-foreground">
            {sources.length} {sources.length === 1 ? "Source" : "Sources"}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sources list */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {sources.map((source, i) => (
            <div
              key={source.id}
              className={cn(
                "space-y-3",
                i > 0 && "pt-5 border-t border-border"
              )}
            >
              {/* Book name */}
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <h3 className="text-base font-semibold text-foreground leading-snug">
                  {source.book_name}
                </h3>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-muted-foreground">{source.author}</span>
                {source.page_num_range && source.page_num_range.length > 0 && (
                  <>
                    <span className="text-border">&middot;</span>
                    <span className="text-muted-foreground">
                      Pages {source.page_num_range.join("-")}
                    </span>
                  </>
                )}
                {source.part_title && (
                  <>
                    <span className="text-border">&middot;</span>
                    <span className="text-muted-foreground">{source.part_title}</span>
                  </>
                )}
              </div>

              {/* Citation text */}
              <div
                className="bg-background border border-border rounded-xl p-4 max-h-48 overflow-y-auto"
                style={{ direction: "rtl", textAlign: "right" }}
              >
                <p className="text-sm leading-[2.2] whitespace-pre-wrap text-foreground font-arabic">
                  {source.text}
                </p>
              </div>

              {/* Open in viewer */}
              <Link
                href={`/books/${source.book_id}?page=${source.start_page_id}`}
                className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg bg-accent hover:bg-accent/80 border border-accent text-accent-foreground text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Book Viewer
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================
// Citation Group Badge (inline in text, shows book names)
// ============================================================

export function CitationGroupBadge({
  sources,
}: {
  ids: number[];
  sources: SourceData[];
}) {
  const [open, setOpen] = useState(false);

  const label =
    sources.length > 0
      ? [...new Set(sources.map((s) => s.book_name))].join("، ")
      : "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 h-5 max-w-[10rem] px-1.5 mx-0.5 text-[10px] font-medium rounded-md bg-accent text-accent-foreground border border-accent hover:bg-accent/80 transition-colors cursor-pointer align-middle"
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap">
          {label}
        </span>
      </button>

      {open && sources.length > 0 && (
        <CitationOverlay sources={sources} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

// ============================================================
// CitationRenderer (processes a text string node)
// ============================================================

interface CitationRendererProps {
  text: string;
  sources: SourceData[];
  isStreaming?: boolean;
}

export function CitationRenderer({
  text,
  sources,
  isStreaming = false,
}: CitationRendererProps) {
  const sourceMap = useMemo(() => {
    const map = new Map<number, SourceData>();
    for (const s of sources) {
      map.set(s.id, s);
    }
    return map;
  }, [sources]);

  const processedText = useMemo(() => {
    const input = isStreaming ? stripIncompleteCitation(text) : text;

    const matches = [...input.matchAll(CITATION_REGEX)];
    if (matches.length === 0) return [input];

    // Merge consecutive citations separated only by whitespace/commas
    const groups: { ids: number[]; start: number; end: number }[] = [];
    for (const match of matches) {
      const matchStart = match.index!;
      const matchEnd = matchStart + match[0].length;
      const ids = match[1]
        .split(/[,،]/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      const last = groups[groups.length - 1];
      if (last) {
        const between = input.slice(last.end, matchStart);
        if (/^[\s,،]*$/.test(between)) {
          last.ids.push(...ids);
          last.end = matchEnd;
          continue;
        }
      }
      groups.push({ ids, start: matchStart, end: matchEnd });
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    for (const group of groups) {
      if (group.start > lastIndex) {
        parts.push(input.slice(lastIndex, group.start));
      }
      const resolved = group.ids
        .map((id) => sourceMap.get(id))
        .filter((s): s is SourceData => !!s);
      if (resolved.length > 0) {
        parts.push(
          <CitationGroupBadge
            key={`${group.start}`}
            ids={group.ids}
            sources={resolved}
          />
        );
      }
      lastIndex = group.end;
    }
    if (lastIndex < input.length) {
      parts.push(input.slice(lastIndex));
    }

    return parts;
  }, [text, sourceMap, isStreaming]);

  return <>{processedText}</>;
}

// ============================================================
// Sources panel shown below a message
// ============================================================

export function SourcesPanel({ sources }: { sources: SourceData[] }) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSources, setSelectedSources] = useState<SourceData[] | null>(
    null
  );

  if (sources.length === 0) return null;

  const shown = expanded ? sources : sources.slice(0, 3);

  return (
    <>
      <div className="mt-4 pt-4 border-t border-border">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors mb-3"
        >
          <BookOpen size={13} />
          {sources.length} Source{sources.length !== 1 ? "s" : ""}
          {!expanded && sources.length > 3 && (
            <span className="text-muted-foreground">&middot; Show all</span>
          )}
        </button>
        <div className="space-y-2">
          {shown.map((source, i) => (
            <button
              key={source.id}
              onClick={() => setSelectedSources([source])}
              className={cn(
                "w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border bg-background/50",
                "hover:border-accent hover:bg-accent/30 transition-all duration-200 group"
              )}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {source.book_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {source.author}
                  {source.page_num_range.length > 0 &&
                    ` · p. ${source.page_num_range.join("-")}`}
                </p>
              </div>
              <ExternalLink
                size={12}
                className="flex-shrink-0 text-border group-hover:text-primary mt-1 transition-colors"
              />
            </button>
          ))}
        </div>
      </div>

      {selectedSources && (
        <CitationOverlay
          sources={selectedSources}
          onClose={() => setSelectedSources(null)}
        />
      )}
    </>
  );
}
