'use client';

import React, { useEffect, useState, use } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { BookHeader } from '@/components/reader/BookHeader';
import { BookContent } from '@/components/reader/BookContent';
import { BookSidebar } from '@/components/reader/BookSidebar';
import type { Book, Page } from '@/types';

export default function BookReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/books/${id}?include_toc=true`)
      .then((r) => r.json())
      .then((data) => setBook(data))
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/books/${id}/pages?page=${currentPage}&limit=5`)
      .then((r) => r.json())
      .then((data) => {
        setPages(data?.data || []);
        setTotalPages(data?.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, currentPage]);

  const toc = book?.table_of_contents
    ? (Array.isArray(book.table_of_contents)
        ? book.table_of_contents
        : []
      ).map((item: any) => ({
        title: typeof item === 'string' ? item : item.title || item.name || '',
        page: typeof item === 'object' ? item.page : undefined,
      }))
    : [];

  if (!book) {
    return (
      <div className="min-h-screen bg-background-primary text-text-primary font-sans flex flex-col overflow-hidden h-screen">
        <Navbar />
        <div className="flex-1 flex items-center justify-center pt-16">
          <p className="text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-primary text-text-primary font-sans flex flex-col overflow-hidden h-screen">
      <Navbar />
      <div className="flex-1 flex pt-16 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <BookHeader book={book} />
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">Loading pages...</div>
          ) : (
            <BookContent pages={pages} currentPage={currentPage} />
          )}
          {/* Page navigation */}
          <div className="border-t border-border-subtle p-4 flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-4 py-2 text-sm bg-background-card border border-border-subtle rounded-md text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-text-muted">
              Page {currentPage} of {Math.ceil(totalPages / 5)}
            </span>
            <button
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={currentPage >= Math.ceil(totalPages / 5)}
              className="px-4 py-2 text-sm bg-background-card border border-border-subtle rounded-md text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
        <BookSidebar
          toc={toc}
          totalPages={totalPages}
          onGoToPage={(p) => setCurrentPage(Math.ceil(p / 5))}
        />
      </div>
    </div>
  );
}
