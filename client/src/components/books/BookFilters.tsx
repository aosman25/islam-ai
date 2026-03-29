'use client';

import React from 'react';
import { Search, Info } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import type { Category, Author } from '@/types';

interface BookFiltersProps {
  categories: Category[];
  authors: Author[];
  selectedCategoryId?: number;
  selectedAuthorId?: number;
  onCategoryChange: (id?: number) => void;
  onAuthorChange: (id?: number) => void;
}

export function BookFilters({
  categories,
  authors,
  selectedCategoryId,
  selectedAuthorId,
  onCategoryChange,
  onAuthorChange,
}: BookFiltersProps) {
  const { t } = useLanguage();

  return (
    <aside className="w-full lg:w-72 space-y-6 flex-shrink-0">
      {/* Category Filter */}
      <div className="bg-background-card border border-border-subtle rounded-lg p-5">
        <h3 className="font-bold text-text-primary flex items-center gap-2 mb-4">
          {t('books.allCategories')} <Info className="w-4 h-4 text-text-muted" />
        </h3>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="category"
              checked={!selectedCategoryId}
              onChange={() => onCategoryChange(undefined)}
              style={{ accentColor: 'var(--accent-gold)' }}
            />
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {t('books.allCategories')}
            </span>
          </label>
          {categories.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="category"
                checked={selectedCategoryId === cat.id}
                onChange={() => onCategoryChange(cat.id)}
                style={{ accentColor: 'var(--accent-gold)' }}
              />
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                {cat.name}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Author Filter */}
      <div className="bg-background-card border border-border-subtle rounded-lg p-5">
        <h3 className="font-bold text-text-primary mb-4">{t('chat.filter.author')}</h3>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="radio"
              name="author"
              checked={!selectedAuthorId}
              onChange={() => onAuthorChange(undefined)}
              style={{ accentColor: 'var(--accent-gold)' }}
            />
            <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
              {t('books.allAuthors')}
            </span>
          </label>
          {authors.map((author) => (
            <label key={author.id} className="flex items-center gap-2 cursor-pointer group">
              <input
                type="radio"
                name="author"
                checked={selectedAuthorId === author.id}
                onChange={() => onAuthorChange(author.id)}
                style={{ accentColor: 'var(--accent-gold)' }}
              />
              <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
                {author.name}
              </span>
            </label>
          ))}
        </div>
      </div>
    </aside>
  );
}
