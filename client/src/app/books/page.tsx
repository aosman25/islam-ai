"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Spinner } from "@/components/ui/spinner";
import { cn, detectDirection } from "@/lib/utils";
import { getBooks, getAuthors, getCategories } from "@/lib/api";
import type { Book, Author, Category } from "@/types";
import {
  Search,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  User,
  Tag,
} from "lucide-react";

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
  const [filtersOpen, setFiltersOpen] = useState(false);

  const limit = 20;

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

  // Load filters
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-page py-8 md:py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Islamic Library
            </h1>
            <p className="text-muted-foreground">
              Browse {total > 0 ? total.toLocaleString() : ""} scholarly works
              across centuries of Islamic scholarship.
            </p>
          </div>

          {/* Search & Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
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
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/30 focus:shadow-sm transition-all"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                filtersOpen || activeFilters > 0
                  ? "border-primary/30 bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilters > 0 && (
                <span className="w-5 h-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* Filters Panel */}
          {filtersOpen && (
            <div className="mb-8 p-5 rounded-xl border border-border bg-card shadow-sm animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Authors filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                    <User size={14} />
                    Authors
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                    {authors.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background cursor-pointer text-sm"
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
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-foreground truncate" dir={detectDirection(a.name)}>
                          {a.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Categories filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-3">
                    <Tag size={14} />
                    Categories
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                    {categories.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-background cursor-pointer text-sm"
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
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-foreground truncate" dir={detectDirection(c.name)}>
                          {c.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {activeFilters > 0 && (
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {activeFilters} filter{activeFilters !== 1 ? "s" : ""} active
                  </p>
                  <button
                    onClick={() => {
                      setSelectedAuthors([]);
                      setSelectedCategories([]);
                      setPage(1);
                    }}
                    className="flex items-center gap-1 text-xs text-destructive hover:text-destructive"
                  >
                    <X size={12} />
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Books Grid */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : books.length === 0 ? (
            <div className="text-center py-20">
              <BookOpen size={40} className="mx-auto text-border mb-4" />
              <p className="text-muted-foreground">No books found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try adjusting your search or filters
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {books.map((book) => (
                  <BookCard key={book.book_id} book={book} />
                ))}
              </div>

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
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let p: number;
                      if (totalPages <= 5) p = i + 1;
                      else if (page <= 3) p = i + 1;
                      else if (page >= totalPages - 2) p = totalPages - 4 + i;
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
                    })}
                  </div>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground mt-4">
                Page {page} of {totalPages} &middot; {total.toLocaleString()} books
              </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function BookCard({ book }: { book: Book }) {
  const dir = detectDirection(book.book_name);

  return (
    <Link
      href={`/books/${book.book_id}`}
      className="group rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md hover:border-accent/60 transition-all duration-300"
    >
      {/* Book icon */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-muted to-border flex items-center justify-center mb-4 group-hover:from-accent group-hover:to-accent transition-colors duration-300">
        <BookOpen size={18} className="text-muted-foreground group-hover:text-primary" />
      </div>

      {/* Title */}
      <h3
        className="text-base font-semibold text-foreground mb-1.5 line-clamp-2 leading-snug"
        dir={dir}
        style={{ textAlign: dir === "rtl" ? "right" : "left" }}
      >
        {book.book_name}
      </h3>

      {/* Author */}
      {book.author_full && (
        <p
          className="text-xs text-muted-foreground mb-3 truncate"
          dir={detectDirection(book.author_full)}
        >
          {book.author_full}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-2 mt-auto">
        {book.category && (
          <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">
            {book.category.name}
          </span>
        )}
        {book.num_pages && (
          <span className="text-[10px] text-muted-foreground">
            {book.num_pages} pages
          </span>
        )}
      </div>
    </Link>
  );
}
