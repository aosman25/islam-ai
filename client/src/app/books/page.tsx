'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { List, LayoutGrid } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { BookGrid } from '@/components/books/BookGrid';
import { BookFilters } from '@/components/books/BookFilters';
import { BookPagination } from '@/components/books/BookPagination';
import { useLanguage } from '@/hooks/useLanguage';
import type { Book, Category, Author } from '@/types';

function BooksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const page = Number(searchParams.get('page')) || 1;
  const categoryId = searchParams.get('category_id') ? Number(searchParams.get('category_id')) : undefined;
  const authorId = searchParams.get('author_id') ? Number(searchParams.get('author_id')) : undefined;

  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      router.push(`/books?${params.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/authors?limit=100').then((r) => r.json()),
    ]).then(([cats, authorsRes]) => {
      setCategories(Array.isArray(cats) ? cats : []);
      setAuthors(authorsRes?.data || []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (categoryId) params.set('category_id', String(categoryId));
    if (authorId) params.set('author_id', String(authorId));

    fetch(`/api/books?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setBooks(data?.data || []);
        setTotal(data?.total || 0);
      })
      .finally(() => setLoading(false));
  }, [page, categoryId, authorId]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-background-primary text-text-primary font-sans">
      <Navbar />
      <main className="pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="mb-12 animate-fade-in">
          <h1 className="text-5xl md:text-6xl font-serif font-bold text-text-primary mb-2">
            {t('books.title')}
          </h1>
          <p className="text-text-secondary">
            {t('books.showing')} {books.length} {t('books.of')} {total} {t('books.books')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <BookFilters
            categories={categories}
            authors={authors}
            selectedCategoryId={categoryId}
            selectedAuthorId={authorId}
            onCategoryChange={(id) =>
              updateParams({ category_id: id ? String(id) : undefined, page: '1' })
            }
            onAuthorChange={(id) =>
              updateParams({ author_id: id ? String(id) : undefined, page: '1' })
            }
          />

          <div className="flex-1">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                <div className="flex bg-background-card border border-border-subtle rounded-md p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded ${
                      viewMode === 'list'
                        ? 'bg-background-secondary text-accent-gold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded ${
                      viewMode === 'grid'
                        ? 'bg-background-secondary text-accent-gold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 text-text-muted">Loading...</div>
            ) : books.length === 0 ? (
              <div className="flex items-center justify-center py-20 text-text-muted">
                {t('books.noResults')}
              </div>
            ) : (
              <BookGrid books={books} viewMode={viewMode} />
            )}

            <BookPagination
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => updateParams({ page: String(p) })}
            />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default function BooksPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background-primary flex items-center justify-center text-text-muted">Loading...</div>}>
      <BooksContent />
    </Suspense>
  );
}
