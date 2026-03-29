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
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-900 mb-2">
              Islamic Library
            </h1>
            <p className="text-ink-500">
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
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search books by title..."
                dir={detectDirection(searchInput)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/60 bg-card text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-gold-300 focus:shadow-soft transition-all"
              />
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                filtersOpen || activeFilters > 0
                  ? "border-gold-300 bg-gold-50 text-gold-700"
                  : "border-border/60 bg-card text-ink-600 hover:bg-parchment-100"
              )}
            >
              <SlidersHorizontal size={15} />
              Filters
              {activeFilters > 0 && (
                <span className="w-5 h-5 rounded-full bg-gold-600 text-white text-xs flex items-center justify-center">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {/* Filters Panel */}
          {filtersOpen && (
            <div className="mb-8 p-5 rounded-xl border border-border/60 bg-card shadow-soft animate-slide-down">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Authors filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-3">
                    <User size={14} />
                    Authors
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                    {authors.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-parchment-50 cursor-pointer text-sm"
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
                          className="rounded border-parchment-400 text-gold-600 focus:ring-gold-500"
                        />
                        <span className="text-ink-700 truncate" dir={detectDirection(a.name)}>
                          {a.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Categories filter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink-700 mb-3">
                    <Tag size={14} />
                    Categories
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-2">
                    {categories.map((c) => (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-parchment-50 cursor-pointer text-sm"
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
                          className="rounded border-parchment-400 text-gold-600 focus:ring-gold-500"
                        />
                        <span className="text-ink-700 truncate" dir={detectDirection(c.name)}>
                          {c.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {activeFilters > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between">
                  <p className="text-xs text-ink-500">
                    {activeFilters} filter{activeFilters !== 1 ? "s" : ""} active
                  </p>
                  <button
                    onClick={() => {
                      setSelectedAuthors([]);
                      setSelectedCategories([]);
                      setPage(1);
                    }}
                    className="flex items-center gap-1 text-xs text-rose-500 hover:text-rose-600"
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
              <BookOpen size={40} className="mx-auto text-parchment-400 mb-4" />
              <p className="text-ink-500">No books found</p>
              <p className="text-sm text-ink-400 mt-1">
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
                    className="p-2 rounded-lg border border-border/60 text-ink-500 hover:bg-parchment-100 disabled:opacity-30 transition-colors"
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
                              ? "bg-gold-600 text-white shadow-soft"
                              : "text-ink-500 hover:bg-parchment-100"
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
                    className="p-2 rounded-lg border border-border/60 text-ink-500 hover:bg-parchment-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <p className="text-center text-xs text-ink-400 mt-4">
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
      className="group rounded-xl border border-border/50 bg-card p-5 shadow-soft hover:shadow-md hover:border-gold-200/60 transition-all duration-300"
    >
      {/* Book icon */}
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-parchment-200 to-parchment-300 flex items-center justify-center mb-4 group-hover:from-gold-100 group-hover:to-gold-200 transition-colors duration-300">
        <BookOpen size={18} className="text-ink-500 group-hover:text-gold-700" />
      </div>

      {/* Title */}
      <h3
        className="font-display text-base font-semibold text-ink-900 mb-1.5 line-clamp-2 leading-snug"
        dir={dir}
        style={{ textAlign: dir === "rtl" ? "right" : "left" }}
      >
        {book.book_name}
      </h3>

      {/* Author */}
      {book.author_full && (
        <p
          className="text-xs text-ink-500 mb-3 truncate"
          dir={detectDirection(book.author_full)}
        >
          {book.author_full}
        </p>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-2 mt-auto">
        {book.category && (
          <span className="px-2 py-0.5 rounded-md bg-parchment-100 text-[10px] font-medium text-ink-500">
            {book.category.name}
          </span>
        )}
        {book.num_pages && (
          <span className="text-[10px] text-ink-400">
            {book.num_pages} pages
          </span>
        )}
      </div>
    </Link>
  );
}
