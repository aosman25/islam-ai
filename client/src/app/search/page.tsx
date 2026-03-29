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
  Search as SearchIcon,
  BookOpen,
  User,
  Tag,
  ArrowRight,
  X,
} from "lucide-react";

type SearchTab = "books" | "authors" | "categories";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>("books");
  const [books, setBooks] = useState<Book[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalBooks, setTotalBooks] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Search books
  const searchBooks = useCallback(async (q: string) => {
    if (!q.trim()) {
      setBooks([]);
      setTotalBooks(0);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await getBooks({ search: q, limit: 20 });
      setBooks(res.data);
      setTotalBooks(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load authors and categories on mount
  useEffect(() => {
    getAuthors().then(setAuthors).catch(console.error);
    getCategories().then(setCategories).catch(console.error);
  }, []);

  // Trigger search on debounced query change
  useEffect(() => {
    if (activeTab === "books") {
      searchBooks(debouncedQuery);
    }
  }, [debouncedQuery, activeTab, searchBooks]);

  // Filter authors/categories by query
  const filteredAuthors = debouncedQuery.trim()
    ? authors.filter((a) =>
        a.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : authors;

  const filteredCategories = debouncedQuery.trim()
    ? categories.filter((c) =>
        c.name.toLowerCase().includes(debouncedQuery.toLowerCase())
      )
    : categories;

  const dir = detectDirection(query);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-page py-12 md:py-20">
          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-ink-900 mb-3">
              Search the Library
            </h1>
            <p className="text-ink-500 max-w-md mx-auto">
              Find books, authors, and categories across the entire corpus of
              Islamic scholarship.
            </p>
          </div>

          {/* Search Input */}
          <div className="relative max-w-2xl mx-auto mb-10">
            <div className="relative">
              <SearchIcon
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for books, authors, or categories..."
                dir={dir}
                className={cn(
                  "w-full pl-12 pr-10 py-4 rounded-xl border border-border/60 bg-card text-base text-ink-800",
                  "placeholder:text-ink-400 focus:outline-none focus:border-gold-300 focus:shadow-md shadow-soft transition-all",
                  dir === "rtl" && "text-right pr-12 pl-10"
                )}
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-ink-400 hover:text-ink-600 hover:bg-parchment-100 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-1 mb-8">
            {[
              { key: "books" as const, label: "Books", icon: BookOpen, count: totalBooks },
              { key: "authors" as const, label: "Authors", icon: User, count: filteredAuthors.length },
              { key: "categories" as const, label: "Categories", icon: Tag, count: filteredCategories.length },
            ].map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  activeTab === key
                    ? "bg-gold-50 text-gold-700 border border-gold-200/60 shadow-soft"
                    : "text-ink-500 hover:text-ink-700 hover:bg-parchment-100"
                )}
              >
                <Icon size={15} />
                {label}
                {debouncedQuery && (
                  <span
                    className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full",
                      activeTab === key
                        ? "bg-gold-200/60 text-gold-800"
                        : "bg-parchment-200 text-ink-500"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="lg" />
            </div>
          ) : (
            <div>
              {/* Books Tab */}
              {activeTab === "books" && (
                <>
                  {!hasSearched ? (
                    <EmptyState
                      icon={SearchIcon}
                      title="Start searching"
                      description="Type a query to search across all books in the library"
                    />
                  ) : books.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="No books found"
                      description="Try a different search term"
                    />
                  ) : (
                    <div className="space-y-3">
                      {books.map((book) => (
                        <SearchBookResult key={book.book_id} book={book} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Authors Tab */}
              {activeTab === "authors" && (
                <>
                  {filteredAuthors.length === 0 ? (
                    <EmptyState
                      icon={User}
                      title="No authors found"
                      description="Try a different search term"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {filteredAuthors.slice(0, 40).map((author) => (
                        <Link
                          key={author.id}
                          href={`/books?author=${author.id}`}
                          className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-gold-200 hover:shadow-soft transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-parchment-100 flex items-center justify-center group-hover:bg-gold-50 transition-colors">
                            <User
                              size={16}
                              className="text-ink-400 group-hover:text-gold-600"
                            />
                          </div>
                          <span
                            className="text-sm font-medium text-ink-800 truncate"
                            dir={detectDirection(author.name)}
                          >
                            {author.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Categories Tab */}
              {activeTab === "categories" && (
                <>
                  {filteredCategories.length === 0 ? (
                    <EmptyState
                      icon={Tag}
                      title="No categories found"
                      description="Try a different search term"
                    />
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {filteredCategories.map((cat) => (
                        <Link
                          key={cat.id}
                          href={`/books?category=${cat.id}`}
                          className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-gold-200 hover:shadow-soft transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-parchment-100 flex items-center justify-center group-hover:bg-gold-50 transition-colors">
                            <Tag
                              size={16}
                              className="text-ink-400 group-hover:text-gold-600"
                            />
                          </div>
                          <span
                            className="text-sm font-medium text-ink-800 truncate"
                            dir={detectDirection(cat.name)}
                          >
                            {cat.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

function SearchBookResult({ book }: { book: Book }) {
  const dir = detectDirection(book.book_name);
  return (
    <Link
      href={`/books/${book.book_id}`}
      className="flex items-start gap-4 p-5 rounded-xl border border-border/50 bg-card hover:border-gold-200 hover:shadow-md transition-all group"
    >
      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-gradient-to-br from-parchment-200 to-parchment-300 flex items-center justify-center group-hover:from-gold-100 group-hover:to-gold-200 transition-colors">
        <BookOpen
          size={18}
          className="text-ink-500 group-hover:text-gold-700"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3
          className="text-base font-semibold text-ink-900 group-hover:text-gold-800 transition-colors"
          dir={dir}
          style={{ textAlign: dir === "rtl" ? "right" : "left" }}
        >
          {book.book_name}
        </h3>
        {book.author_full && (
          <p className="text-sm text-ink-500 mt-0.5">{book.author_full}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-2">
          {book.category && (
            <span className="px-2 py-0.5 rounded bg-parchment-100 text-[10px] font-medium text-ink-500">
              {book.category.name}
            </span>
          )}
          {book.num_pages && (
            <span className="text-[10px] text-ink-400">
              {book.num_pages} pages
            </span>
          )}
        </div>
      </div>
      <ArrowRight
        size={16}
        className="flex-shrink-0 text-ink-300 group-hover:text-gold-500 mt-1 group-hover:translate-x-1 transition-all"
      />
    </Link>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center py-16">
      <Icon size={36} className="mx-auto text-parchment-400 mb-4" />
      <p className="text-ink-600 font-medium">{title}</p>
      <p className="text-sm text-ink-400 mt-1">{description}</p>
    </div>
  );
}
