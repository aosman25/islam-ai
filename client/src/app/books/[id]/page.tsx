"use client";

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Panel,
  Group as PanelGroup,
  Separator as ResizeHandle,
} from "react-resizable-panels";
import { Spinner } from "@/components/ui/spinner";
import { cn, detectDirection } from "@/lib/utils";
import { getBook, getBookPages } from "@/lib/api";
import type { Book, BookPage, TocEntry } from "@/types";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  GripVertical,
  List,
  Info,
  PanelRightClose,
  PanelRightOpen,
  NotepadText,
} from "lucide-react";

type SidebarTab = "toc" | "info";

const BRACKETED_NUMBERS_RE = /\[[\d٠-٩،,\-\s]+\][.،,؛:]?/g;
const FONT_MARKER_RE = /<font[^>]*color="#be0000"[^>]*>[\d٠-٩\s\-]+<\/font>/g;
const SPECIAL_BRACKET_RE = /⦗[\d٠-٩\s\-]+⦘/g;
const EMPTY_PS_RE = /(<p[^>]*>\s*<\/p>\s*)+/g;

type PageGroup = {
  pageNum: number;
  partTitle: string;
  pages: BookPage[];
  html: string;
};

function groupPagesByNum(pages: BookPage[]): PageGroup[] {
  const groups: PageGroup[] = [];
  for (const p of pages) {
    const last = groups[groups.length - 1];
    if (last && last.pageNum === p.page_num) {
      last.pages.push(p);
      last.html = last.html.replace(/<\/div>\s*$/, "</div><br><br>") + cleanPageHtml(p.display_elem);
      if (p.part_title) last.partTitle = p.part_title;
    } else {
      groups.push({
        pageNum: p.page_num,
        partTitle: p.part_title,
        pages: [p],
        html: cleanPageHtml(p.display_elem),
      });
    }
  }
  return groups;
}

function cleanPageHtml(html: string): string {
  return html.replace(FONT_MARKER_RE, "").replace(BRACKETED_NUMBERS_RE, "").replace(SPECIAL_BRACKET_RE, "").replace(EMPTY_PS_RE, "<br><br>");
}

function GroupedPages({ pages, showFootnotes }: { pages: BookPage[]; showFootnotes: boolean }) {
  const groups = useMemo(() => groupPagesByNum(pages), [pages]);
  return (
    <>
      {groups.map((group, i) => (
        <div key={group.pages[0].page_id} id={`page-${group.pages[0].page_id}`}>
          {i > 0 && (
            <div className="flex items-center gap-3 my-8 select-none">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground bg-background px-2 tabular-nums">
                {group.pageNum}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
          )}

          {group.partTitle &&
            (i === 0 || group.partTitle !== groups[i - 1]?.partTitle) && (
              <h2
                className="text-xl font-bold text-foreground mb-6 text-center"
                dir={detectDirection(group.partTitle)}
              >
                {group.partTitle}
              </h2>
            )}

          <div
            className={cn("prose-arabic", !showFootnotes && "hide-footnotes")}
            dangerouslySetInnerHTML={{ __html: group.html }}
          />
        </div>
      ))}
    </>
  );
}

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
  const [loadingBefore, setLoadingBefore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasBefore, setHasBefore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 768) setSidebarOpen(true);
  }, []);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("toc");
  const [showFootnotes, setShowFootnotes] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const readerRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const firstOffsetRef = useRef(0);

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
          firstOffsetRef.current = res.offset;
          setHasMore(res.data.length === 20);
          setHasBefore(res.offset > 0);
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

  const loadBefore = useCallback(async () => {
    if (loadingBefore || !hasBefore) return;
    const beforeOffset = firstOffsetRef.current;
    if (beforeOffset <= 0) { setHasBefore(false); return; }
    setLoadingBefore(true);
    try {
      const loadCount = Math.min(20, beforeOffset);
      const newOffset = beforeOffset - loadCount;
      const res = await getBookPages(bookId, { offset: newOffset, limit: loadCount });
      if (res.data.length > 0) {
        // preserve scroll position
        const reader = readerRef.current;
        const prevHeight = reader?.scrollHeight ?? 0;
        setPages((prev) => [...res.data, ...prev]);
        firstOffsetRef.current = newOffset;
        setHasBefore(newOffset > 0);
        // restore scroll after prepend
        requestAnimationFrame(() => {
          if (reader) {
            const newHeight = reader.scrollHeight;
            reader.scrollTop += newHeight - prevHeight;
          }
        });
      } else {
        setHasBefore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBefore(false);
    }
  }, [bookId, loadingBefore, hasBefore]);

  // Bottom sentinel observer
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

  // Top sentinel observer
  useEffect(() => {
    if (!topSentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadBefore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(topSentinelRef.current);
    return () => observer.disconnect();
  }, [loadBefore]);

  const navigateToPage = useCallback(
    async (pageId: number) => {
      // If the page is already loaded, scroll to it
      const existingEl = readerRef.current?.querySelector(`#page-${pageId}`);
      if (existingEl) {
        existingEl.scrollIntoView({ behavior: "instant", block: "start" });
        return;
      }

      setSeeking(true);
      try {
        const res = await getBookPages(bookId, {
          startPageId: pageId,
          limit: 20,
        });
        setPages(res.data);
        setOffset(res.offset + res.data.length);
        firstOffsetRef.current = res.offset;
        setHasMore(res.data.length === 20);
        setHasBefore(res.offset > 0);
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
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto" />
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
          <Link
            href="/books"
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const tocEntries = (book.table_of_contents as TocEntry[] | null) ?? [];

  return (
    <div className="h-svh w-svw flex flex-col overflow-hidden bg-background">
      {/* Navigation Bar */}
      <ReaderNavBar
        book={book}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        showFootnotes={showFootnotes}
        onToggleFootnotes={() => setShowFootnotes(!showFootnotes)}
      />

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 w-full overflow-hidden relative">
        {/* Mobile sidebar drawer */}
        {sidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-foreground/20 backdrop-blur-sm z-30"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div
          className={cn(
            "md:hidden fixed inset-y-0 right-0 z-30 w-[85vw] max-w-[320px] bg-card border-l border-border shadow-xl transition-transform duration-300 pt-12",
            sidebarOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <ReaderSidebar
            book={book}
            tocEntries={tocEntries}
            sidebarTab={sidebarTab}
            onTabChange={setSidebarTab}
            onNavigate={(pageId) => {
              navigateToPage(pageId);
              setSidebarOpen(false);
            }}
          />
        </div>

        <PanelGroup
          orientation="horizontal"
          style={{ height: "100%", width: "100%" }}
        >
          {/* Reader Panel */}
          <Panel defaultSize={sidebarOpen ? "70%" : "100%"} minSize="50%">
            <div className="relative h-full">
              <div
                ref={readerRef}
                className="h-full overflow-y-auto [overflow-anchor:none]"
              >
                {seeking && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                    <Spinner size="lg" />
                  </div>
                )}

                <div className="w-full px-5 lg:px-8">
                  <div className="mx-auto max-w-4xl py-8">
                    <h1
                      className="text-2xl font-bold text-foreground leading-snug"
                      dir={detectDirection(book.book_name)}
                    >
                      {book.book_name}
                    </h1>
                    {book.author_full && (
                      <p
                        className="text-base text-muted-foreground mt-2"
                        dir={detectDirection(book.author_full)}
                      >
                        {book.author_full}
                      </p>
                    )}
                  </div>
                  <div className="mx-auto max-w-4xl">
                    <div className="h-px bg-border" />
                  </div>
                </div>

                <article className="max-w-4xl mx-auto px-5 md:px-12 lg:px-16 py-6">
                  <div ref={topSentinelRef} className="h-1" />
                  {loadingBefore && (
                    <div className="flex justify-center py-4">
                      <Spinner />
                    </div>
                  )}

                  <GroupedPages pages={pages} showFootnotes={showFootnotes} />

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
                </article>
              </div>
            </div>
          </Panel>

          {/* Desktop sidebar panel */}
          {sidebarOpen && (
            <>
              <ResizeHandle className="hidden md:flex group relative w-2 items-center justify-center bg-border/50 transition-colors hover:bg-primary/20 active:bg-primary/30">
                <GripVertical
                  size={12}
                  className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                />
              </ResizeHandle>

              <Panel
                defaultSize="30%"
                minSize="15%"
                maxSize="50%"
                collapsible
                collapsedSize={0}
                className="hidden md:block"
              >
                <ReaderSidebar
                  book={book}
                  tocEntries={tocEntries}
                  sidebarTab={sidebarTab}
                  onTabChange={setSidebarTab}
                  onNavigate={navigateToPage}
                />
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

/* ============================================================
   Navigation Bar
   ============================================================ */

function ReaderNavBar({
  book,
  sidebarOpen,
  onToggleSidebar,
  showFootnotes,
  onToggleFootnotes,
}: {
  book: Book;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  showFootnotes: boolean;
  onToggleFootnotes: () => void;
}) {
  return (
    <header className="flex items-center justify-between h-12 px-4 lg:px-6 border-b border-border bg-background/95 backdrop-blur-lg z-20 flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Link
          href="/books"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="h-5 w-px bg-border flex-shrink-0" />

        <div className="min-w-0 flex items-center gap-2">
          <h1
            className="text-sm font-semibold text-foreground truncate"
            dir={detectDirection(book.book_name)}
          >
            {book.book_name}
          </h1>
          {(book.author?.name || book.author_full) && (
            <>
              <div className="h-4 w-px bg-border flex-shrink-0 hidden sm:block" />
              <p
                className="text-xs text-muted-foreground truncate hidden sm:block"
                dir={detectDirection(book.author?.name || book.author_full || "")}
              >
                {book.author?.name || book.author_full}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleFootnotes}
          className={cn(
            "p-1.5 rounded-lg transition-colors flex-shrink-0",
            showFootnotes
              ? "text-primary bg-primary/10 hover:bg-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
          title={showFootnotes ? "Hide footnotes" : "Show footnotes"}
        >
          <NotepadText size={16} />
        </button>

        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex-shrink-0"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
        {sidebarOpen ? (
          <PanelRightClose size={16} />
        ) : (
          <PanelRightOpen size={16} />
        )}
      </button>
      </div>
    </header>
  );
}

/* ============================================================
   Sidebar
   ============================================================ */

function ReaderSidebar({
  book,
  tocEntries,
  sidebarTab,
  onTabChange,
  onNavigate,
}: {
  book: Book;
  tocEntries: TocEntry[];
  sidebarTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onNavigate: (pageId: number) => void;
}) {
  const tabs = [
    { key: "toc" as const, label: "Contents", icon: List },
    { key: "info" as const, label: "Details", icon: Info },
  ];

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Tab Buttons */}
      <div className="flex border-b border-border flex-shrink-0">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onTabChange(key)}
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

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {sidebarTab === "toc" ? (
          <TocPanel entries={tocEntries} onNavigate={onNavigate} />
        ) : (
          <InfoPanel book={book} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TOC Panel — Tree View (inspired by usul-dev)
   ============================================================ */

interface TocTreeItem {
  id: number;
  title: string;
  pageId: number;
  children: TocTreeItem[];
}

function buildTocTree(entries: TocEntry[]): TocTreeItem[] {
  const map = new Map<number, TocTreeItem>();
  const roots: TocTreeItem[] = [];

  for (const e of entries) {
    map.set(e.id, { id: e.id, title: e.title, pageId: e.page_id, children: [] });
  }

  for (const e of entries) {
    const node = map.get(e.id)!;
    const parentId = e.parent ?? e.parent_id;
    if (parentId && parentId !== 0 && map.has(parentId)) {
      map.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}


function TocPanel({
  entries,
  onNavigate,
}: {
  entries: TocEntry[];
  onNavigate: (pageId: number) => void;
}) {
  const tree = useMemo(() => buildTocTree(entries), [entries]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (item: TocTreeItem) => {
      setSelectedId(String(item.id));
      onNavigate(item.pageId);
    },
    [onNavigate]
  );

  if (entries.length === 0) {
    return (
      <div className="p-6 text-center">
        <List size={24} className="mx-auto text-border mb-3" />
        <p className="text-xs text-muted-foreground">
          No table of contents available
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Tree */}
      <div className="p-2" role="tree" dir="rtl">
        {tree.map((item) => (
          <TocTreeNode
            key={item.id}
            item={item}
            depth={0}
            expandedIds={expandedIds}
            selectedId={selectedId}
            onToggle={toggleExpand}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );
}

function TocTreeNode({
  item,
  depth,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: {
  item: TocTreeItem;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: TocTreeItem) => void;
}) {
  const hasChildren = item.children.length > 0;
  const isExpanded = expandedIds.has(String(item.id));
  const isSelected = selectedId === String(item.id);
  const dir = detectDirection(item.title);

  if (!hasChildren) {
    return (
      <button
        onClick={() => onSelect(item)}
        className={cn(
          "group relative w-full flex items-center py-2 text-sm transition-colors rounded-lg cursor-pointer",
          "hover:bg-accent/70",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingInlineStart: `${8 + depth * 16}px`, paddingInlineEnd: 8 }}
        dir={dir}
      >
        <span className={cn("truncate", isSelected ? "font-medium" : "text-muted-foreground")} title={item.title}>
          {item.title}
        </span>
      </button>
    );
  }

  return (
    <div>
      {/* Node trigger */}
      <button
        onClick={() => {
          const wasExpanded = expandedIds.has(String(item.id));
          onToggle(String(item.id));
          if (wasExpanded) onSelect(item);
        }}
        className={cn(
          "group relative w-full flex items-center py-2.5 text-sm transition-colors rounded-lg cursor-pointer",
          "hover:bg-accent/70",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingInlineStart: `${4 + depth * 16}px`, paddingInlineEnd: 8 }}
        dir={dir}
      >
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-200 me-1 rotate-180",
            isExpanded && "!rotate-90"
          )}
        />
        <span className={cn("truncate font-medium", isSelected ? "text-primary" : "text-foreground")} title={item.title}>
          {item.title}
        </span>
      </button>

      {/* Children with connector line */}
      {isExpanded && (
        <div className="relative" style={{ paddingInlineStart: `${12 + depth * 16}px` }}>
          {/* Vertical connector */}
          <div
            className="absolute top-0 bottom-0 w-[2px] bg-border hover:bg-foreground/30 transition-colors cursor-pointer"
            style={{ insetInlineStart: `${7 + depth * 16}px` }}
            onClick={() => onToggle(String(item.id))}
          />
          {item.children.map((child) => (
            <TocTreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Info Panel
   ============================================================ */

function InfoPanel({ book }: { book: Book }) {
  const fields = [
    { label: "Author", value: book.author_full },
    { label: "Editor", value: book.editor },
    { label: "Edition", value: book.edition },
    { label: "Publisher", value: book.publisher },
    { label: "Volumes", value: book.num_volumes?.match(/^\d+/)?.[0] },
    { label: "Pages", value: book.num_pages?.match(/^\d+/)?.[0] },
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
