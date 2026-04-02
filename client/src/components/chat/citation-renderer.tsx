"use client";

import { useState, useMemo, useEffect, createContext, useContext, useCallback } from "react";
import { createPortal } from "react-dom";
import type { SourceData } from "@/types";
import { cn, detectDirection } from "@/lib/utils";
import { BookOpen, X, ExternalLink, Languages, Loader2 } from "lucide-react";
import Link from "next/link";

// ============================================================
// Book metadata lookup from local JSON
// ============================================================

interface BookMeta {
  book_name: string;
  book_name_ar: string;
  author_id: number;
}

interface AuthorMeta {
  name: string;
  name_ar: string;
}

let booksData: Record<string, BookMeta> | null = null;
let authorsData: Record<string, AuthorMeta> | null = null;
let loadingPromise: Promise<void> | null = null;

function ensureLoaded(): Promise<void> {
  if (booksData && authorsData) return Promise.resolve();
  if (!loadingPromise) {
    loadingPromise = Promise.all([
      fetch("/data/books_transliteration.json").then((r) => r.json()),
      fetch("/data/authors_transliteration.json").then((r) => r.json()),
    ]).then(([b, a]) => {
      booksData = b;
      authorsData = a;
    });
  }
  return loadingPromise;
}

function extractBookId(chunkId: number): number {
  return Math.floor(chunkId / 10_000_000);
}

function getBookMeta(bookId: number): { bookName: string; bookNameAr: string; authorName: string; authorNameAr: string } | null {
  if (!booksData) return null;
  const book = booksData[String(bookId)];
  if (!book) return null;
  const author = authorsData?.[String(book.author_id)];
  return {
    bookName: book.book_name ?? book.book_name_ar ?? "",
    bookNameAr: book.book_name_ar ?? book.book_name ?? "",
    authorName: author?.name ?? "",
    authorNameAr: author?.name_ar ?? "",
  };
}

function useBookMetaLoaded() {
  const [loaded, setLoaded] = useState(!!booksData);
  useEffect(() => {
    if (!loaded) ensureLoaded().then(() => setLoaded(true));
  }, [loaded]);
  return loaded;
}

// ============================================================
// Overlay context — survives re-renders during streaming
// ============================================================

const OverlayContext = createContext<{
  open: (sources: SourceData[]) => void;
}>({ open: () => {} });

export function CitationOverlayProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<SourceData[] | null>(null);
  const open = useCallback((s: SourceData[]) => setSources(s), []);
  const close = useCallback(() => setSources(null), []);

  return (
    <OverlayContext.Provider value={{ open }}>
      {children}
      {sources && sources.length > 0 && (
        <CitationOverlay sources={sources} onClose={close} />
      )}
    </OverlayContext.Provider>
  );
}

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
// Translatable chunk — shows Arabic text with on-demand English translation
// ============================================================

function TranslatableChunk({ text }: { text: string }) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  const handleTranslate = async () => {
    if (translation) {
      setShowTranslation((v) => !v);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.translated) {
        setTranslation(data.translated);
        setShowTranslation(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className="bg-background border border-border rounded-xl p-4 max-h-48 overflow-y-auto"
        style={{ direction: "rtl", textAlign: "right" }}
      >
        <p className="text-sm leading-[2.2] whitespace-pre-wrap text-foreground font-arabic">
          {text}
        </p>
      </div>
      {showTranslation && translation && (
        <div className="bg-background border border-border rounded-xl p-4 max-h-48 overflow-y-auto">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {translation}
          </p>
        </div>
      )}
      <button
        onClick={handleTranslate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Languages className="w-3.5 h-3.5" />
        )}
        {loading ? "Translating…" : showTranslation ? "Hide translation" : "Translate to English"}
      </button>
    </div>
  );
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
  useBookMetaLoaded();
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
          {sources.map((source, i) => {
            const bookId = extractBookId(source.id);
            const meta = getBookMeta(bookId);
            return (
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
                <div>
                  <h3 className="text-base font-semibold text-foreground leading-snug">
                    {meta?.bookName ?? source.book_name}
                  </h3>
                  {meta?.bookNameAr && (
                    <p className="text-sm text-muted-foreground mt-0.5" dir="rtl">
                      {meta.bookNameAr}
                    </p>
                  )}
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-muted-foreground">{meta?.authorName || source.author}</span>
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
              <TranslatableChunk text={source.text} />

              {/* Open in viewer */}
              <Link
                href={`/books/${bookId}?page=${source.start_page_id}`}
                className="inline-flex items-center gap-2 py-1.5 px-3 rounded-lg bg-accent hover:bg-accent/80 border border-accent text-accent-foreground text-xs font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open in Book Viewer
              </Link>
            </div>
          );
          })}
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
  isArabicResponse,
}: {
  ids: number[];
  sources: SourceData[];
  isArabicResponse?: boolean;
}) {
  const { open } = useContext(OverlayContext);
  useBookMetaLoaded();

  const label = useMemo(() => {
    if (sources.length === 0) return "";
    const names = new Set<string>();
    for (const s of sources) {
      const bookId = extractBookId(s.id);
      const meta = getBookMeta(bookId);
      if (meta) {
        names.add(isArabicResponse ? meta.bookNameAr : meta.bookName);
      } else {
        names.add(s.book_name);
      }
    }
    return [...names].join(isArabicResponse ? "، " : ", ");
  }, [sources, isArabicResponse]);

  return (
    <button
      onClick={() => open(sources)}
      className="inline-flex items-center gap-1 h-5 max-w-[10rem] px-1.5 mx-0.5 text-[10px] font-medium rounded-md bg-accent text-accent-foreground border border-accent hover:bg-accent/80 transition-colors cursor-pointer align-middle"
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">
        {label}
      </span>
    </button>
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

  const isArabicResponse = useMemo(() => detectDirection(text) === "rtl", [text]);

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
            isArabicResponse={isArabicResponse}
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

function extractCitedIds(content: string): Set<number> {
  const ids = new Set<number>();
  for (const match of content.matchAll(CITATION_REGEX)) {
    for (const s of match[1].split(/[,،]/)) {
      const n = parseInt(s.trim(), 10);
      if (!isNaN(n)) ids.add(n);
    }
  }
  return ids;
}

export function SourcesPanel({ sources, content }: { sources: SourceData[]; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const { open } = useContext(OverlayContext);
  useBookMetaLoaded();

  const citedSources = useMemo(() => {
    const citedIds = extractCitedIds(content);
    return sources.filter((s) => citedIds.has(s.id));
  }, [sources, content]);

  if (citedSources.length === 0) return null;

  const shown = expanded ? citedSources : citedSources.slice(0, 3);
  const hasMore = citedSources.length > 3;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
        <BookOpen size={13} />
        {citedSources.length} Source{citedSources.length !== 1 ? "s" : ""} cited
      </div>
      <div className="space-y-2">
        {shown.map((source, i) => {
          const bookId = extractBookId(source.id);
          const meta = getBookMeta(bookId);
          return (
          <button
            key={source.id}
            onClick={() => open([source])}
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
                {meta?.bookName ?? source.book_name}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {meta?.authorName || source.author}
                {source.page_num_range.length > 0 &&
                  ` · p. ${source.page_num_range.join("-")}`}
              </p>
            </div>
            <ExternalLink
              size={12}
              className="flex-shrink-0 text-border group-hover:text-primary mt-1 transition-colors"
            />
          </button>
          );
        })}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          {expanded ? "Show less" : `Show all ${citedSources.length} sources`}
        </button>
      )}
    </div>
  );
}
