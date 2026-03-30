"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Spinner } from "@/components/ui/spinner";
import { cn, detectDirection } from "@/lib/utils";
import { getBooks, getAuthors, getCategories } from "@/lib/api";
import { FilterSearchInput } from "@/components/ui/filter-search-input";
import { GeometricPattern } from "@/components/ui/geometric-pattern";
import type { Book, Author, Category } from "@/types";
import {
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Tag,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Filter Container                                                    */
/* ------------------------------------------------------------------ */
function FilterSection({
  title,
  icon: Icon,
  children,
  onClear,
  showClear,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  onClear?: () => void;
  showClear?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon size={14} />
          {title}
        </h3>
        {showClear && onClear && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80"
          >
            <X size={10} />
            Clear
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile Drawer                                                       */
/* ------------------------------------------------------------------ */
function FilterDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] bg-background border-r border-border shadow-xl transition-transform duration-300 overflow-y-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Filters</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">{children}</div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                           */
/* ------------------------------------------------------------------ */
export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedAuthors, setSelectedAuthors] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [authorSearch, setAuthorSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [view, setView] = useState<"list" | "grid">("list");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const limit = 20;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBooks({
        page,
        limit,
        search: search || undefined,
        author_ids: selectedAuthors.length ? selectedAuthors : undefined,
        category_ids: selectedCategories.length ? selectedCategories : undefined,
      });
      setBooks(res.data);
      setTotal(res.total);
    } catch (err) {
      console.error("Failed to load books:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedAuthors, selectedCategories]);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    getAuthors().then(setAuthors).catch(console.error);
    getCategories().then(setCategories).catch(console.error);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(total / limit);
  const activeFilters = selectedAuthors.length + selectedCategories.length;

  const filteredAuthors = authors.filter((a) =>
    a.name.toLowerCase().includes(authorSearch.toLowerCase())
  );

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const filtersContent = (
    <>
      {/* Categories */}
      <FilterSection
        title="Categories"
        icon={Tag}
        onClear={() => {
          setSelectedCategories([]);
          setCategorySearch("");
          setPage(1);
        }}
        showClear={selectedCategories.length > 0}
      >
        <FilterSearchInput
          value={categorySearch}
          onChange={setCategorySearch}
          placeholder="Search categories..."
        />
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {(categorySearch ? filteredCategories : categories).map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(c.id)}
                onChange={() => {
                  setSelectedCategories((prev) =>
                    prev.includes(c.id)
                      ? prev.filter((id) => id !== c.id)
                      : [...prev, c.id]
                  );
                  setPage(1);
                }}
                className="rounded border-border text-primary focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span
                className="text-sm text-foreground truncate flex-1"
                dir={detectDirection(c.name)}
              >
                {c.name}
              </span>
            </label>
          ))}
          {categorySearch && filteredCategories.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-2">
              No categories found
            </p>
          )}
        </div>
      </FilterSection>

      {/* Authors */}
      <FilterSection
        title="Authors"
        icon={User}
        onClear={() => {
          setSelectedAuthors([]);
          setAuthorSearch("");
          setPage(1);
        }}
        showClear={selectedAuthors.length > 0}
      >
        <FilterSearchInput
          value={authorSearch}
          onChange={setAuthorSearch}
          placeholder="Search authors..."
        />


        {/* Author list */}
        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {(authorSearch ? filteredAuthors : authors).map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedAuthors.includes(a.id)}
                onChange={() => {
                  setSelectedAuthors((prev) =>
                    prev.includes(a.id)
                      ? prev.filter((id) => id !== a.id)
                      : [...prev, a.id]
                  );
                  setPage(1);
                }}
                className="rounded border-border text-primary focus:ring-0 focus:ring-offset-0 h-4 w-4"
              />
              <span
                className="text-sm text-foreground truncate flex-1"
                dir={detectDirection(a.name)}
              >
                {a.name}
              </span>
            </label>
          ))}
          {authorSearch && filteredAuthors.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-2">
              No authors found
            </p>
          )}
        </div>
      </FilterSection>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-border bg-gradient-to-b from-muted/60 via-muted/30 to-background">
          <div className="absolute inset-0 opacity-[0.05]">
            <GeometricPattern />
          </div>

          <div className="relative mx-auto max-w-7xl px-page py-12 md:py-16">
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
              Islamic Library
            </h1>
            <p className="text-muted-foreground mt-2 max-w-lg">
              Browse 2,500+ scholarly works across centuries of Islamic scholarship.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-page py-8">
          {/* Grid: sidebar + results */}
          <div className="grid grid-cols-1 sm:grid-cols-[260px_1fr] gap-8">
            {/* Sidebar — desktop only */}
            <aside className="hidden sm:flex flex-col gap-4">
              {filtersContent}
            </aside>

            {/* Results panel */}
            <div>
              {/* Toolbar: search + sort + view + mobile filter toggle */}
              <div className="flex items-center gap-3 mb-6">
                {/* Search */}
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search books by title..."
                    dir={detectDirection(searchInput)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border-none bg-card text-sm text-foreground placeholder:text-muted-foreground !outline-none !ring-0 focus:shadow-md transition-all"
                  />
                </div>

                {/* View switcher */}
                <button
                  onClick={() => setView(view === "list" ? "grid" : "list")}
                  className="p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
                  title={
                    view === "list" ? "Switch to grid view" : "Switch to list view"
                  }
                >
                  {view === "list" ? <LayoutGrid size={16} /> : <List size={16} />}
                </button>

                {/* Mobile filter toggle */}
                <button
                  onClick={() => setDrawerOpen(true)}
                  className={cn(
                    "sm:hidden flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all",
                    activeFilters > 0
                      ? "border-primary/30 bg-accent text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  <SlidersHorizontal size={16} />
                  {activeFilters > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                      {activeFilters}
                    </span>
                  )}
                </button>
              </div>


              {/* Results */}
              {loading ? (
                <div className="flex justify-center py-20">
                  <Spinner size="lg" />
                </div>
              ) : books.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-border py-20">
                  <BookOpen size={40} className="text-border mb-4" />
                  <p className="text-muted-foreground">No books found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                <>
                  {view === "grid" ? (
                    <div className="grid grid-cols-2 gap-y-6 sm:gap-6 md:gap-8 lg:grid-cols-3">
                      {books.map((book) => (
                        <BookGridCard key={book.book_id} book={book} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {books.map((book) => (
                        <BookListCard key={book.book_id} book={book} />
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-10">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let p: number;
                            if (totalPages <= 5) p = i + 1;
                            else if (page <= 3) p = i + 1;
                            else if (page >= totalPages - 2)
                              p = totalPages - 4 + i;
                            else p = page - 2 + i;
                            return (
                              <button
                                key={p}
                                onClick={() => setPage(p)}
                                className={cn(
                                  "w-9 h-9 rounded-lg text-sm font-medium transition-all",
                                  p === page
                                    ? "bg-primary text-white shadow-sm"
                                    : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {p}
                              </button>
                            );
                          }
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}

                  <p className="text-center text-xs text-muted-foreground mt-4">
                    Page {page} of {totalPages} &middot;{" "}
                    {total.toLocaleString()} books
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile filter drawer */}
      <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        {filtersContent}
      </FilterDrawer>

      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color palette — deterministic per book based on id                  */
/* ------------------------------------------------------------------ */

const COVER_PALETTES = [
  { bg: "#1a3a2a", accent: "#2d6a4f", text: "#d8f3dc" },  // deep green
  { bg: "#1b2838", accent: "#2a4a6b", text: "#cce3f0" },  // navy
  { bg: "#2d1b2e", accent: "#5c3a60", text: "#e8d0ea" },  // plum
  { bg: "#3b1c1c", accent: "#6b3030", text: "#f0d0d0" },  // burgundy
  { bg: "#1a2a3a", accent: "#2e4e6e", text: "#c8ddf0" },  // slate blue
  { bg: "#1c2e2e", accent: "#2a5454", text: "#c8e8e8" },  // teal
  { bg: "#2a1f14", accent: "#5a4030", text: "#e8d8c4" },  // mahogany
  { bg: "#1e2a1e", accent: "#3a5a3a", text: "#d0e8d0" },  // forest
];

function getCoverPalette(id: number) {
  return COVER_PALETTES[id % COVER_PALETTES.length];
}

/* ------------------------------------------------------------------ */
/*  Generative Book Cover                                               */
/* ------------------------------------------------------------------ */

function BookCover({
  book,
  className,
}: {
  book: Book;
  className?: string;
}) {
  const palette = getCoverPalette(book.book_id);
  const dir = detectDirection(book.book_name);

  // Simple hash for pattern variation
  const seed = book.book_id * 7 + 13;
  const patternType = seed % 3;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md aspect-[1600/2300] w-full select-none",
        className
      )}
      style={{ backgroundColor: palette.bg }}
    >
      {/* Decorative pattern */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.08]"
        viewBox="0 0 200 290"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {patternType === 0 && (
          /* Repeating 8-pointed star grid */
          <>
            {Array.from({ length: 6 }, (_, row) =>
              Array.from({ length: 4 }, (_, col) => {
                const cx = col * 55 + 25;
                const cy = row * 55 + 20;
                const r1 = 22;
                const r2 = 10;
                const points = Array.from({ length: 8 }, (_, i) => {
                  const angle = (Math.PI / 4) * i - Math.PI / 2;
                  const r = i % 2 === 0 ? r1 : r2;
                  return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
                }).join(" ");
                return (
                  <polygon
                    key={`${row}-${col}`}
                    points={points}
                    stroke={palette.text}
                    strokeWidth="0.5"
                  />
                );
              })
            )}
          </>
        )}
        {patternType === 1 && (
          /* Concentric circles / arches */
          <>
            {Array.from({ length: 8 }, (_, i) => (
              <circle
                key={i}
                cx="100"
                cy="145"
                r={20 + i * 18}
                stroke={palette.text}
                strokeWidth="0.4"
              />
            ))}
            {/* Radial lines */}
            {Array.from({ length: 12 }, (_, i) => {
              const angle = (Math.PI * 2 * i) / 12;
              return (
                <line
                  key={i}
                  x1="100"
                  y1="145"
                  x2={100 + 160 * Math.cos(angle)}
                  y2={145 + 160 * Math.sin(angle)}
                  stroke={palette.text}
                  strokeWidth="0.3"
                />
              );
            })}
          </>
        )}
        {patternType === 2 && (
          /* Interlocking diamond lattice */
          <>
            {Array.from({ length: 8 }, (_, row) =>
              Array.from({ length: 5 }, (_, col) => {
                const cx = col * 45 + (row % 2 === 0 ? 10 : 32);
                const cy = row * 40 + 15;
                return (
                  <polygon
                    key={`${row}-${col}`}
                    points={`${cx},${cy - 16} ${cx + 18},${cy} ${cx},${cy + 16} ${cx - 18},${cy}`}
                    stroke={palette.text}
                    strokeWidth="0.4"
                  />
                );
              })
            )}
          </>
        )}
      </svg>

      {/* Top accent bar */}
      <div
        className="absolute top-0 inset-x-0 h-1.5"
        style={{ backgroundColor: palette.accent }}
      />

      {/* Top decorative line */}
      <div
        className="absolute top-6 left-[12%] right-[12%] h-px"
        style={{ backgroundColor: palette.text, opacity: 0.15 }}
      />

      {/* Category label */}
      {book.category && (
        <div className="absolute top-8 inset-x-0 flex justify-center">
          <span
            className="text-[9px] tracking-[0.15em] uppercase font-medium px-2"
            style={{ color: palette.text, opacity: 0.5 }}
          >
            {book.category.name}
          </span>
        </div>
      )}

      {/* Title area — centered */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-[14%]">
        <div
          className="w-8 h-px mb-4"
          style={{ backgroundColor: palette.text, opacity: 0.25 }}
        />
        <h3
          className="text-center text-sm font-bold leading-snug line-clamp-4"
          style={{ color: palette.text }}
          dir={dir}
        >
          {book.book_name}
        </h3>
        <div
          className="w-8 h-px mt-4"
          style={{ backgroundColor: palette.text, opacity: 0.25 }}
        />
      </div>

      {/* Author — bottom */}
      {book.author_full && (
        <div className="absolute bottom-5 inset-x-0 flex justify-center px-[10%]">
          <p
            className="text-center text-[10px] leading-tight line-clamp-2"
            style={{ color: palette.text, opacity: 0.6 }}
            dir={detectDirection(book.author_full)}
          >
            {book.author_full}
          </p>
        </div>
      )}

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 inset-x-0 h-1"
        style={{ backgroundColor: palette.accent }}
      />

      {/* Spine shadow */}
      <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/20 to-transparent" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Book Cards — Grid                                                   */
/* ------------------------------------------------------------------ */

function BookGridCard({ book }: { book: Book }) {
  return (
    <Link
      href={`/books/${book.book_id}`}
      className="group relative block w-full"
    >
      <div className="transition-all duration-300 group-hover:scale-[1.02] rounded-md p-1 group-hover:bg-muted">
        <BookCover book={book} />
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Book Cards — List (like usul-dev EntityCard + small cover)          */
/* ------------------------------------------------------------------ */

function BookListCard({ book }: { book: Book }) {
  const dir = detectDirection(book.book_name);
  const authorDir = book.author_full ? detectDirection(book.author_full) : "ltr";

  return (
    <Link
      href={`/books/${book.book_id}`}
      className="group w-full border-b border-border bg-transparent px-2 py-4 transition-colors hover:bg-muted sm:px-3"
    >
        {/* Title */}
        <h3
          className="text-base font-semibold text-foreground line-clamp-2"
          dir={dir}
        >
          {book.book_name}
        </h3>

        {/* Author */}
        {book.author_full && (
          <p
            className="text-muted-foreground text-xs mt-1"
            dir={authorDir}
          >
            {book.author_full}
          </p>
        )}

        {/* Tags */}
        <div className="mt-2 flex flex-wrap gap-2">
          {book.category && (
            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-normal text-muted-foreground">
              {book.category.name}
            </span>
          )}
          {book.num_pages && (
            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-normal text-muted-foreground">
              {book.num_pages} pages
            </span>
          )}
          {book.num_volumes && (
            <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-normal text-muted-foreground">
              {book.num_volumes} vol.
            </span>
          )}
        </div>
    </Link>
  );
}
