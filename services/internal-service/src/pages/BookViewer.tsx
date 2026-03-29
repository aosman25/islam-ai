import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import type { Book, BookPage } from '../types/services';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ArrowLeft, User, Tag, Hash, Layers, Calendar, FileText,
  ChevronDown, ChevronRight as ChevronRightIcon, List, Info, X, GripVertical,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 20;

// ─── Styles ───────────────────────────────────────────────────────────────────

const PAGE_STYLES = `
  /* ── Scrollable panes ─────────────────────────────────────────────────── */
  .reader-pane,
  .toc-pane {
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #1e3a5f33 transparent;
  }
  .reader-pane::-webkit-scrollbar,
  .toc-pane::-webkit-scrollbar { width: 4px; }
  .reader-pane::-webkit-scrollbar-track,
  .toc-pane::-webkit-scrollbar-track { background: transparent; }
  .reader-pane::-webkit-scrollbar-thumb,
  .toc-pane::-webkit-scrollbar-thumb { background: #1e3a5f55; border-radius: 9999px; }

  /* ── Arabic text ──────────────────────────────────────────────────────── */
  .reader-pane .PageText {
    font-family: 'Amiri', 'Noto Naskh Arabic', 'Scheherazade New',
                 'Traditional Arabic', Georgia, serif;
    font-size: 1.15rem;
    line-height: 2.35;
    color: #b8c8dc;
    direction: rtl;
    text-align: justify;
    text-justify: inter-word;
    word-spacing: 0.04em;
  }

  /* ── Page head (suppress redundant info already in our divider) ─────── */
  .reader-pane .PageHead { display: none; }

  /* ── Body hr ────────────────────────────────────────────────────────── */
  .reader-pane hr {
    border: none;
    border-top: 1px solid #0d1825;
    margin: 0.4rem 0;
  }

  /* ── Paragraphs ─────────────────────────────────────────────────────── */
  .reader-pane p { margin: 0.1rem 0; }

  /* ── In-text title anchors ──────────────────────────────────────────── */
  .reader-pane span[data-type="title"] {
    display: block;
    font-size: 1rem;
    font-weight: 700;
    color: #7a98b8;
    margin: 0.75rem 0 0.15rem;
    scroll-margin-top: 60px;
  }

  /* ── Footnotes ──────────────────────────────────────────────────────── */
  .reader-pane .footnote {
    margin-top: 1.25rem;
    padding-top: 0.6rem;
    border-top: 1px solid #0d1825;
    font-size: 0.78rem;
    color: #3a4d62;
    line-height: 1.9;
    direction: rtl;
  }

  /* ── Superscripts ───────────────────────────────────────────────────── */
  .reader-pane sup {
    font-size: 0.58em;
    vertical-align: super;
    line-height: 0;
  }

  /* ── Kill ALL inline colors ─────────────────────────────────────────── */
  .reader-pane font[color],
  .reader-pane [color],
  .reader-pane *[style*="color"] { color: inherit !important; }

  /* ── Page divider ───────────────────────────────────────────────────── */
  .page-sep {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.9rem 0;
    direction: ltr;
  }
  .page-sep::before,
  .page-sep::after {
    content: '';
    flex: 1;
    height: 1px;
    background: #0d1825;
  }
  .page-sep span {
    font-size: 0.58rem;
    font-family: ui-monospace, monospace;
    color: #1e3347;
    letter-spacing: 0.1em;
    white-space: nowrap;
  }

  /* ── Scroll margin for page anchors ─────────────────────────────────── */
  .page-anchor { scroll-margin-top: 8px; }
`;

// ─── TOC types & tree ─────────────────────────────────────────────────────────

interface TocEntry {
  id: number;
  title: string;
  parent: number;
  page_id: number;
  page_num: number;
  children: TocEntry[];
}

function buildTocTree(flat: Omit<TocEntry, 'children'>[]): TocEntry[] {
  const map = new Map<number, TocEntry>();
  flat.forEach(e => map.set(e.id, { ...e, children: [] }));
  const roots: TocEntry[] = [];
  flat.forEach(e => {
    const node = map.get(e.id)!;
    if (e.parent === 0) roots.push(node);
    else {
      const parent = map.get(e.parent);
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
  });
  return roots;
}

// ─── TocNode ──────────────────────────────────────────────────────────────────

interface TocNodeProps {
  node: TocEntry;
  depth: number;
  activeTocId: number;
  onNavigate: (pageId: number, tocId: number) => void;
}

const TocNode: React.FC<TocNodeProps> = ({ node, depth, activeTocId, onNavigate }) => {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === activeTocId;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setOpen(o => !o);
          onNavigate(node.page_id, node.id);
        }}
        className={`w-full flex items-start gap-1.5 rounded-md px-2 py-1.5 text-right transition-colors duration-150 group
          ${isActive
            ? 'bg-teal-500/10 text-teal-300'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'}`}
        style={{ paddingRight: `${0.5 + depth * 0.8}rem` }}
      >
        <span className="flex-shrink-0 mt-[3px] w-3.5 flex justify-center">
          {hasChildren
            ? open
              ? <ChevronDown className="w-2.5 h-2.5 opacity-40" />
              : <ChevronRightIcon className="w-2.5 h-2.5 opacity-40" />
            : <span className="block w-[3px] h-[3px] rounded-full bg-current opacity-25 mt-[4px]" />}
        </span>
        <span
          className="flex-1 text-right leading-snug"
          dir="rtl"
          lang="ar"
          style={{ fontSize: depth === 0 ? '0.7rem' : '0.65rem' }}
        >
          {node.title}
        </span>
      </button>

      {hasChildren && open && (
        <div>
          {node.children.map(child => (
            <TocNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeTocId={activeTocId}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── MetaItem ─────────────────────────────────────────────────────────────────

interface MetaItemProps { icon: React.ReactNode; label: string; value: string | null | undefined }
const MetaItem: React.FC<MetaItemProps> = ({ icon, label, value }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-slate-600 mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-[9px] text-slate-600 uppercase tracking-wider">{label}</div>
        <div className="text-xs text-slate-400 mt-0.5" dir="rtl" lang="ar">{value}</div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const BookViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const bookId = Number(id);

  // Deep-link navigation state from citation
  const scrollState = (location.state as { scrollToPageId?: number } | null);
  const initialScrollPageId = scrollState?.scrollToPageId ?? null;

  const [book, setBook] = useState<Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bookError, setBookError] = useState<string | null>(null);
  const [metaOpen, setMetaOpen] = useState(false);

  const [pages, setPages] = useState<BookPage[]>([]);
  const [pagesTotal, setPagesTotal] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [prevOffset, setPrevOffset] = useState(-1);
  const [loadingNext, setLoadingNext] = useState(false);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [allNextLoaded, setAllNextLoaded] = useState(false);
  const [seekingPage, setSeekingPage] = useState(initialScrollPageId !== null);
  const navigatingRef = useRef(false);

  const [tocTree, setTocTree] = useState<TocEntry[]>([]);
  const [flatToc, setFlatToc] = useState<Omit<TocEntry, 'children'>[]>([]);
  const [activePageId, setActivePageId] = useState(0);

  const [clickedTocId, setClickedTocId] = useState(0);

  // Active TOC entry: highest page_id ≤ current visible page.
  // When multiple entries share the same page_id, prefer the one the user clicked.
  const activeTocId = useMemo(() => {
    if (!activePageId || !flatToc.length) return 0;
    let bestId = 0;
    let bestPageId = -1;
    for (const e of flatToc) {
      if (e.page_id <= activePageId && e.page_id > bestPageId) {
        bestPageId = e.page_id;
        bestId = e.id;
      }
    }
    // If the user clicked a TOC entry on the same page, prefer it
    if (clickedTocId) {
      const clicked = flatToc.find(e => e.id === clickedTocId);
      if (clicked && clicked.page_id === bestPageId) {
        bestId = clickedTocId;
      }
    }
    return bestId;
  }, [activePageId, flatToc, clickedTocId]);

  const [tocWidth, setTocWidth] = useState(256);
  const [isDragging, setIsDragging] = useState(false);

  const initialNavDone = useRef(false);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const loadedPageIds = useRef<Set<number>>(new Set());
  // Captures scroll state before a prepend so useLayoutEffect can restore position
  const prependScrollRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // ── Load book metadata ──────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setBookLoading(true);
      try {
        const result = await apiService.getBook(bookId);
        setBook(result);
        if (Array.isArray(result.table_of_contents)) {
          const flat = result.table_of_contents as Omit<TocEntry, 'children'>[];
          setFlatToc(flat);
          setTocTree(buildTocTree(flat));
        }
      } catch (err: unknown) {
        setBookError((err as { message?: string }).message || 'Failed to load book');
      } finally {
        setBookLoading(false);
      }
    };
    load();
  }, [bookId]);

  // ── Fetch next batch (downward append) ─────────────────────────────────
  const fetchNextBatch = useCallback(async () => {
    if (navigatingRef.current || loadingNext || allNextLoaded) return;
    setLoadingNext(true);
    try {
      const result = await apiService.getBookPages(bookId, { offset: nextOffset, limit: PAGE_LIMIT });
      if (navigatingRef.current) return;
      const newPages = result.data.filter(p => !loadedPageIds.current.has(p.page_id));
      newPages.forEach(p => loadedPageIds.current.add(p.page_id));
      setPages(prev => [...prev, ...newPages]);
      setPagesTotal(result.total);
      const newNextOffset = nextOffset + PAGE_LIMIT;
      if (newNextOffset >= result.total) setAllNextLoaded(true);
      else setNextOffset(newNextOffset);
    } catch { /* retry on next intersection */ }
    finally { setLoadingNext(false); }
  }, [bookId, nextOffset, loadingNext, allNextLoaded]);

  // ── Fetch prev batch (upward prepend) ──────────────────────────────────
  const fetchPrevBatch = useCallback(async () => {
    if (navigatingRef.current || loadingPrev || prevOffset < 0) return;
    setLoadingPrev(true);
    try {
      const actualOffset = Math.max(0, prevOffset);
      const limit = prevOffset >= 0 ? PAGE_LIMIT : PAGE_LIMIT + prevOffset;
      const result = await apiService.getBookPages(bookId, { offset: actualOffset, limit });
      if (navigatingRef.current) return;
      const newPages = result.data.filter(p => !loadedPageIds.current.has(p.page_id));
      newPages.forEach(p => loadedPageIds.current.add(p.page_id));
      if (newPages.length > 0) {
        prependScrollRef.current = {
          scrollHeight: readerRef.current?.scrollHeight ?? 0,
          scrollTop: readerRef.current?.scrollTop ?? 0,
        };
        setPages(prev => [...newPages, ...prev]);
      }
      setPrevOffset(prevOffset - PAGE_LIMIT);
    } catch { /* retry on next intersection */ }
    finally { setLoadingPrev(false); }
  }, [bookId, prevOffset, loadingPrev]);

  // ── Bottom sentinel IntersectionObserver (infinite scroll down) ─────────
  useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchNextBatch(); },
      { root: readerRef.current, rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchNextBatch]);

  // ── Top sentinel IntersectionObserver (infinite scroll up) ─────────────
  useEffect(() => {
    const el = topSentinelRef.current;
    if (!el || prevOffset < 0) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchPrevBatch(); },
      { root: readerRef.current, rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [fetchPrevBatch, prevOffset]);

  // ── Restore scroll position after prepend (runs before paint) ───────────
  useLayoutEffect(() => {
    const data = prependScrollRef.current;
    if (!data || !readerRef.current) return;
    const delta = readerRef.current.scrollHeight - data.scrollHeight;
    readerRef.current.scrollTop = data.scrollTop + delta;
    prependScrollRef.current = null;
  }, [pages]);

  // ── Track active page via scroll ─────────────────────────────────────────
  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;
    const onScroll = () => {
      const readerTop = reader.getBoundingClientRect().top;
      const anchors = reader.querySelectorAll<HTMLElement>('[data-page-id]');
      let activeId = 0;
      for (const anchor of anchors) {
        const relTop = anchor.getBoundingClientRect().top - readerTop;
        if (relTop <= 80) activeId = Number(anchor.getAttribute('data-page-id'));
        else break;
      }
      if (activeId) {
        setActivePageId(prev => {
          if (prev !== activeId) setClickedTocId(0);
          return activeId;
        });
      }
    };
    reader.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => reader.removeEventListener('scroll', onScroll);
  }, [pages]);

  // ── Navigate from TOC click ─────────────────────────────────────────────
  const navigateToPage = useCallback(async (pageId: number) => {
    if (!readerRef.current) return;
    const el = readerRef.current.querySelector(`#page-${pageId}`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: 'start' });
      return;
    }
    navigatingRef.current = true;
    setSeekingPage(true);
    try {
      const result = await apiService.getBookPages(bookId, { startPageId: pageId, limit: PAGE_LIMIT });
      loadedPageIds.current.clear();
      result.data.forEach(p => loadedPageIds.current.add(p.page_id));
      const offset = result.offset;
      flushSync(() => {
        setPages(result.data);
        setPagesTotal(result.total);
        setNextOffset(offset + PAGE_LIMIT);
        setPrevOffset(offset - PAGE_LIMIT);
        setAllNextLoaded(offset + PAGE_LIMIT >= result.total);
        setSeekingPage(false);
      });
      const target = readerRef.current?.querySelector(`#page-${pageId}`) as HTMLElement | null;
      target?.scrollIntoView({ block: 'start' });
    } catch { /* ignore */ }
    finally { requestAnimationFrame(() => { navigatingRef.current = false; }); }
  }, [bookId]);

  // ── Initial deep-link navigation (citation) ─────────────────────────────
  useEffect(() => {
    if (!initialScrollPageId || initialNavDone.current) return;
    initialNavDone.current = true;
    navigateToPage(initialScrollPageId);
  }, [initialScrollPageId, navigateToPage]);

  // ── Resize handler ──────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = tocWidth;
    setIsDragging(true);

    const onMove = (ev: MouseEvent) => {
      const delta = dragStartX.current - ev.clientX;
      setTocWidth(Math.max(160, Math.min(520, dragStartWidth.current + delta)));
    };
    const onUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [tocWidth]);

  // ── Layout ──────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col h-full${isDragging ? ' select-none' : ''}`}>
      <style>{PAGE_STYLES}</style>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 border-b border-slate-800/60">
        <button
          onClick={() => navigate('/books')}
          className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-200 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Library
        </button>

        <div className="w-px h-4 bg-slate-800 flex-shrink-0" />

        {bookLoading ? (
          <span className="text-sm text-slate-600 italic">Loading…</span>
        ) : book ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1
              className="text-sm font-semibold text-slate-200 truncate flex-1 min-w-0"
              dir="rtl" lang="ar"
            >
              {book.book_name}
            </h1>
            {book.author && (
              <span className="text-[11px] text-slate-500 truncate hidden sm:block" dir="rtl">
                {book.author.name}
              </span>
            )}
            {book.category && (
              <span className="hidden sm:inline-flex px-2 py-0.5 bg-slate-800/60 border border-slate-700/30 rounded-full text-[10px] text-slate-500 flex-shrink-0">
                {book.category.name}
              </span>
            )}
            <button
              onClick={() => setMetaOpen(o => !o)}
              title="Book details"
              className="flex-shrink-0 p-1 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-colors"
            >
              {metaOpen ? <X className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : bookError ? (
          <span className="text-xs text-rose-400">{bookError}</span>
        ) : null}

        {pagesTotal > 0 && (
          <span className="text-[10px] font-mono text-slate-700 flex-shrink-0">
            {pages.length}/{pagesTotal}
          </span>
        )}
      </div>

      {/* ── Metadata drawer ── */}
      {metaOpen && book && (
        <div className="flex-shrink-0 border-b border-slate-800/60 bg-slate-900/40 px-6 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2">
            <MetaItem icon={<User className="w-3 h-3" />} label="Author" value={book.author?.name ?? book.author_full} />
            <MetaItem icon={<FileText className="w-3 h-3" />} label="Editor" value={book.editor} />
            <MetaItem icon={<Hash className="w-3 h-3" />} label="Edition" value={book.edition} />
            <MetaItem icon={<Layers className="w-3 h-3" />} label="Publisher" value={book.publisher} />
            <MetaItem icon={<Hash className="w-3 h-3" />} label="Volumes" value={book.num_volumes} />
            <MetaItem icon={<FileText className="w-3 h-3" />} label="Pages" value={book.num_pages} />
            <MetaItem icon={<Calendar className="w-3 h-3" />} label="Pub. Date" value={book.shamela_pub_date} />
            <MetaItem icon={<Tag className="w-3 h-3" />} label="Category" value={book.category?.name} />
          </div>
        </div>
      )}

      {/* ── Two-column body ── */}
      <div className="flex flex-1 overflow-hidden gap-0">

        {/* Reader pane */}
        <div className="relative flex-1 min-w-0 overflow-hidden">
          {seekingPage && (
            <div className="absolute inset-0 z-10 bg-[#080f1c] flex items-center justify-center">
              <LoadingSpinner size="lg" text="Navigating to page…" />
            </div>
          )}
          <div ref={readerRef} className="reader-pane h-full bg-[#080f1c]">
            <div className="px-8 sm:px-16 py-8 max-w-4xl mx-auto">

              {/* Top sentinel — triggers upward batch loading */}
              <div ref={topSentinelRef} className="h-2" />

              {loadingPrev && (
                <div className="flex justify-center py-6">
                  <LoadingSpinner size="sm" text="" />
                </div>
              )}

              {pages.map((pg, idx) => (
                <div
                  key={pg.page_id}
                  id={`page-${pg.page_id}`}
                  data-page-id={pg.page_id}
                  className="page-anchor"
                >
                  {idx > 0 && (
                    <div className="page-sep">
                      <span>p.{pg.page_num}</span>
                    </div>
                  )}
                  <div dangerouslySetInnerHTML={{ __html: pg.display_elem }} />
                </div>
              ))}

              {/* Bottom sentinel — triggers downward batch loading */}
              <div ref={bottomSentinelRef} className="h-2" />

              {loadingNext && (
                <div className="flex justify-center py-10">
                  <LoadingSpinner size="md" text="Loading pages…" />
                </div>
              )}
              {allNextLoaded && pages.length > 0 && (
                <div className="text-center py-8 text-[10px] text-slate-800 tracking-[0.3em] uppercase">
                  ── end ──
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Resize handle */}
        {tocTree.length > 0 && (
          <div
            onMouseDown={onResizeMouseDown}
            className={`flex-shrink-0 w-[5px] flex items-center justify-center cursor-col-resize group relative z-10
              ${isDragging ? 'bg-teal-500/30' : 'bg-slate-800/40 hover:bg-teal-500/20'}
              transition-colors duration-150`}
            title="Drag to resize"
          >
            <GripVertical className="w-2.5 h-2.5 text-slate-700 group-hover:text-teal-500/60 transition-colors pointer-events-none" />
          </div>
        )}

        {/* TOC pane */}
        {tocTree.length > 0 && (
          <div
            className="toc-pane flex-shrink-0 border-l border-slate-800/60 bg-slate-950/60"
            style={{ width: tocWidth }}
          >
            <div className="sticky top-0 flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/40 bg-slate-950/80 backdrop-blur-sm z-10">
              <List className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Contents</span>
            </div>
            <div className="p-2 space-y-0.5">
              {tocTree.map(root => (
                <TocNode
                  key={root.id}
                  node={root}
                  depth={0}
                  activeTocId={activeTocId}
                  onNavigate={(pageId, tocId) => { setClickedTocId(tocId); navigateToPage(pageId); }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
