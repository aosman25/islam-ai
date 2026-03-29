import React from 'react';
import { BookCard } from './BookCard';
import type { Book } from '@/types';

export function BookGrid({
  books,
  viewMode,
}: {
  books: Book[];
  viewMode: 'list' | 'grid';
}) {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map((book) => (
          <BookCard key={book.book_id} book={book} viewMode="grid" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {books.map((book) => (
        <BookCard key={book.book_id} book={book} viewMode="list" />
      ))}
    </div>
  );
}
