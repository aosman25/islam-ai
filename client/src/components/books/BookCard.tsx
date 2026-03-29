import React from 'react';
import Link from 'next/link';
import { Badge } from '../ui/Badge';
import type { Book } from '@/types';

export function BookCard({ book, viewMode = 'list' }: { book: Book; viewMode?: 'list' | 'grid' }) {
  if (viewMode === 'grid') {
    return (
      <Link href={`/books/${book.book_id}`} className="group cursor-pointer no-underline">
        <div className="aspect-[3/4] rounded-lg overflow-hidden relative p-6 flex flex-col items-center justify-center text-center mb-3 shadow-lg transition-transform duration-300 group-hover:-translate-y-1 bg-background-surface">
          <div className="absolute inset-0 pattern-grid opacity-30" />
          <div className="relative z-10">
            <h4 className="text-xl font-arabic text-text-primary mb-2 leading-relaxed" dir="rtl">
              {book.book_name}
            </h4>
            {book.author && (
              <p className="text-sm font-arabic text-text-secondary" dir="rtl">
                {book.author.name}
              </p>
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium text-text-primary mb-1 group-hover:text-accent-gold transition-colors line-clamp-1">
            {book.book_name}
          </h3>
          {book.author_full && (
            <p className="text-xs text-text-secondary line-clamp-1">{book.author_full}</p>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/books/${book.book_id}`}
      className="group bg-background-card border border-border-subtle rounded-lg p-5 hover:border-accent-gold/30 transition-all duration-200 cursor-pointer flex flex-col sm:flex-row justify-between gap-4 no-underline block"
    >
      <div className="flex-1">
        <h3 className="text-base font-medium text-text-primary mb-1 group-hover:text-accent-gold transition-colors">
          {book.book_name}
        </h3>
        {book.author_full && (
          <p className="text-sm text-accent-gold mb-3">{book.author_full}</p>
        )}
        <div className="flex gap-2">
          {book.category && (
            <Badge variant="default" className="text-[10px] uppercase tracking-wider">
              {book.category.name}
            </Badge>
          )}
          {book.num_volumes && (
            <Badge variant="default" className="text-[10px]">
              {book.num_volumes} vol.
            </Badge>
          )}
        </div>
      </div>
      <div className="text-right sm:max-w-xs">
        <h4 className="text-lg font-arabic text-text-primary mb-1" dir="rtl">
          {book.book_name}
        </h4>
        {book.author && (
          <p className="text-sm font-arabic text-text-secondary" dir="rtl">
            {book.author.name}
          </p>
        )}
      </div>
    </Link>
  );
}
