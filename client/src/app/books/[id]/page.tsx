"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/spinner";
import { cn, detectDirection } from "@/lib/utils";
import { getBook, getBookPages } from "@/lib/api";
import type { Book, BookPage, TocEntry } from "@/types";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  List,
  Info,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

type SidebarTab = "toc" | "info";

export default function BookViewerPage() {
  return (
    <Suspense>
      <BookViewerInner />
    </Suspense>
  );
}

function BookViewerInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = Number(params.id);
  const startPageParam = searchParams.get("page");

  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<BookPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("toc");
  const [seeking, setSeeking] = useState(false);

  const readerRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBook(bookId)
      .then((b) => {
        if (!cancelled) setBook(b);
      })
      .catch(console.error);

    const opts = startPageParam
      ? { startPageId: Number(startPageParam), limit: 20 }
      : { page: 1, limit: 20 };

    getBookPages(bookId, opts)
      .then((res) => {
        if (!cancelled) {
          setPages(res.data);
          setOffset(res.offset + res.data.length);
          setHasMore(res.data.length === 20);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, startPageParam]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await getBookPages(bookId, { offset, limit: 20 });
      setPages((prev) => [...prev, ...res.data]);
      setOffset(res.offset + res.data.length);
      setHasMore(res.data.length === 20);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }, [bookId, offset, loadingMore, hasMore]);

  useEffect(() => {
    if (!bottomSentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "400px" }
    );
    observer.observe(bottomSentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore]);

  const navigateToPage = useCallback(
    async (pageId: number) => {
      setSeeking(true);
      try {
        const res = await getBookPages(bookId, {
          startPageId: pageId,
          limit: 20,
        });
        setPages(res.data);
        setOffset(res.offset + res.data.length);
        setHasMore(res.data.length === 20);
        if (readerRef.current) readerRef.current.scrollTop = 0;
      } catch (err) {
        console.error(err);
      } finally {
        setSeeking(false);
      }
    },
    [bookId]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground mt-4">Loading book...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <BookOpen size={40} className="mx-auto text-border mb-4" />
          <p className="text-foreground font-medium">Book not found</p>
          <Link href="/books" className="text-sm text-primary hover:underline mt-2 inline-block">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const tocEntries = (book.table_of_contents as TocEntry[] | null) ?? [];

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card/90 backdrop-blur-lg z-10 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/books"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <h1
              className="text-sm font-semibold text-foreground truncate"
              dir={detectDirection(book.book_name)}
            >
              {book.book_name}
            </h1>
            {book.author_full && (
              <p className="text-[11px] text-muted-foreground truncate">
                {book.author_full}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
        >
          {sidebarOpen ? (
            <PanelRightClose size={18} />
          ) : (
            <PanelRightOpen size={18} />
          )}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Reader */}
        <div
          ref={readerRef}
          className="flex-1 overflow-y-auto relative"
        >
          {seeking && (
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
              <Spinner size="lg" />
            </div>
          )}

          <div className="max-w-3xl mx-auto px-6 md:px-12 py-8">
            {pages.map((p, i) => (
              <div key={`${p.book_id}-${p.page_id}`} id={`page-${p.page_id}`}>
                {i > 0 && (
                  <div className="flex items-center gap-3 my-8 select-none">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] font-medium text-muted-foreground bg-background px-2">
                      {p.page_num}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}

                {p.part_title && (i === 0 || p.part_title !== pages[i - 1]?.part_title) && (
                  <h2
                    className="text-xl font-bold text-foreground mb-6 text-center"
                    dir={detectDirection(p.part_title)}
                  >
                    {p.part_title}
                  </h2>
                )}

                <div
                  className="prose-arabic"
                  dangerouslySetInnerHTML={{ __html: p.display_elem }}
                />
              </div>
            ))}

            <div ref={bottomSentinelRef} className="h-4" />

            {loadingMore && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}

            {!hasMore && pages.length > 0 && (
              <div className="text-center py-12">
                <div className="divider-diamond max-w-xs mx-auto mb-4">
                  <div className="diamond" />
                </div>
                <p className="text-xs text-muted-foreground">End of text</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-72 lg:w-80 border-l border-border bg-card flex flex-col flex-shrink-0 overflow-hidden">
            <div className="flex border-b border-border">
              {[
                { key: "toc" as const, label: "Contents", icon: List },
                { key: "info" as const, label: "Details", icon: Info },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSidebarTab(key)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors border-b-2",
                    sidebarTab === key
                      ? "border-primary text-primary bg-accent/50"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {sidebarTab === "toc" ? (
                <TocPanel entries={tocEntries} onNavigate={navigateToPage} />
              ) : (
                <InfoPanel book={book} />
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function TocPanel({
  entries,
  onNavigate,
}: {
  entries: TocEntry[];
  onNavigate: (pageId: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="p-6 text-center">
        <List size={24} className="mx-auto text-border mb-3" />
        <p className="text-xs text-muted-foreground">No table of contents available</p>
      </div>
    );
  }

  const roots = entries.filter((e) => !e.parent_id);

  return (
    <div className="py-2">
      {roots.map((entry) => (
        <TocItem
          key={entry.id}
          entry={entry}
          allEntries={entries}
          onNavigate={onNavigate}
          depth={0}
        />
      ))}
    </div>
  );
}

function TocItem({
  entry,
  allEntries,
  onNavigate,
  depth,
}: {
  entry: TocEntry;
  allEntries: TocEntry[];
  onNavigate: (pageId: number) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = allEntries.filter((e) => e.parent_id === entry.id);
  const hasChildren = children.length > 0;
  const dir = detectDirection(entry.title);

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setExpanded(!expanded);
          onNavigate(entry.page_id);
        }}
        className={cn(
          "w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted transition-colors text-sm",
          depth > 0 && "text-xs"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        dir={dir}
      >
        {hasChildren && (
          <span className="flex-shrink-0 mt-0.5 text-muted-foreground">
            {expanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
          </span>
        )}
        <span
          className={cn(
            "flex-1 leading-relaxed",
            depth === 0
              ? "font-medium text-foreground"
              : "text-muted-foreground"
          )}
        >
          {entry.title}
        </span>
      </button>
      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <TocItem
              key={child.id}
              entry={child}
              allEntries={allEntries}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InfoPanel({ book }: { book: Book }) {
  const fields = [
    { label: "Author", value: book.author_full },
    { label: "Editor", value: book.editor },
    { label: "Edition", value: book.edition },
    { label: "Publisher", value: book.publisher },
    { label: "Volumes", value: book.num_volumes },
    { label: "Pages", value: book.num_pages },
    { label: "Category", value: book.category?.name },
  ].filter((f) => f.value);

  return (
    <div className="p-5 space-y-4">
      <h3
        className="text-lg font-semibold text-foreground leading-snug"
        dir={detectDirection(book.book_name)}
      >
        {book.book_name}
      </h3>

      <div className="accent-line" />

      <dl className="space-y-3">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {label}
            </dt>
            <dd
              className="text-sm text-foreground mt-0.5"
              dir={detectDirection(String(value))}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
