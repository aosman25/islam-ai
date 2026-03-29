import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import type { Book, Author, Category } from '../types/services';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MultiSelect } from '../components/MultiSelect';
import type { SelectOption } from '../components/MultiSelect';
import { BookOpen, Search, ChevronLeft, ChevronRight, X, Loader2, User, Tag } from 'lucide-react';

const LIMIT = 20;
const DEBOUNCE_MS = 350;

export const BooksLibrary: React.FC = () => {
  const navigate = useNavigate();

  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [nameInput, setNameInput] = useState('');
  const [nameSearch, setNameSearch] = useState('');
  const [selectedAuthors, setSelectedAuthors] = useState<number[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  // Options for multi-selects
  const [authorOptions, setAuthorOptions] = useState<SelectOption[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const totalPages = Math.ceil(total / LIMIT);

  // Load filter options once
  useEffect(() => {
    const load = async () => {
      try {
        const [authors, categories] = await Promise.all([
          apiService.getAuthors(),
          apiService.getCategories(),
        ]);
        setAuthorOptions(
          (authors as Author[]).map(a => ({ id: a.id, name: a.name }))
        );
        setCategoryOptions(
          (categories as Category[]).map(c => ({ id: c.id, name: c.name }))
        );
      } catch { /* options are optional */ }
    };
    load();
  }, []);

  // Debounced book-name search
  const handleNameInput = (value: string) => {
    setNameInput(value);
    setSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setNameSearch(value);
      setPage(1);
      setSearching(false);
    }, DEBOUNCE_MS);
  };

  const clearName = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setNameInput('');
    setNameSearch('');
    setSearching(false);
    setPage(1);
  };

  const handleAuthorsChange = (ids: number[]) => {
    setSelectedAuthors(ids);
    setPage(1);
  };

  const handleCategoriesChange = (ids: number[]) => {
    setSelectedCategories(ids);
    setPage(1);
  };

  // Load books whenever filters/page change
  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiService.getBooks({
        page,
        limit: LIMIT,
        search: nameSearch.trim() || undefined,
        author_ids: selectedAuthors.length ? selectedAuthors : undefined,
        category_ids: selectedCategories.length ? selectedCategories : undefined,
      });
      setBooks(result.data);
      setTotal(result.total);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Failed to load books');
    } finally {
      setLoading(false);
    }
  }, [page, nameSearch, selectedAuthors, selectedCategories]);

  useEffect(() => { loadBooks(); }, [loadBooks]);

  const hasFilters = nameSearch || selectedAuthors.length > 0 || selectedCategories.length > 0;

  const clearAllFilters = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setNameInput('');
    setNameSearch('');
    setSearching(false);
    setSelectedAuthors([]);
    setSelectedCategories([]);
    setPage(1);
  };

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex-shrink-0">
          <BookOpen className="w-5 h-5 text-teal-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-100 tracking-tight">Books Library</h2>
          <p className="text-sm text-slate-500 mt-0.5">Search by title, or filter by author and category.</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-slate-900/50 border border-slate-700/30 rounded-xl p-4 space-y-3">

        {/* Book name search */}
        <div className="space-y-1">
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            <Search className="w-3 h-3" /> Book Title
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              {searching
                ? <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin" />
                : <Search className="w-3.5 h-3.5 text-slate-600" />
              }
            </div>
            <input
              type="text"
              value={nameInput}
              onChange={e => handleNameInput(e.target.value)}
              placeholder="ابحث في عنوان الكتاب…"
              dir="rtl"
              lang="ar"
              className="w-full bg-slate-800/60 border border-slate-700/40 rounded-xl pl-9 pr-9 py-2
                         text-sm text-slate-200 placeholder:text-slate-600
                         focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20
                         transition-colors"
            />
            {nameInput && (
              <button
                onClick={clearName}
                className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-200 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Author + Category row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <User className="w-3 h-3" /> Author
            </label>
            <MultiSelect
              options={authorOptions}
              selected={selectedAuthors}
              onChange={handleAuthorsChange}
              placeholder="Filter by author…"
              emptyText="No authors found"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              <Tag className="w-3 h-3" /> Category
            </label>
            <MultiSelect
              options={categoryOptions}
              selected={selectedCategories}
              onChange={handleCategoriesChange}
              placeholder="Filter by category…"
              emptyText="No categories found"
            />
          </div>
        </div>

        {/* Clear all */}
        {hasFilters && (
          <div className="flex justify-end">
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3 h-3" /> Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* ── Results meta ── */}
      {!loading && (
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>{total.toLocaleString()} book{total !== 1 ? 's' : ''}</span>
          {totalPages > 1 && <span>Page {page} / {totalPages}</span>}
        </div>
      )}

      {/* ── Book grid ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" text="Loading books…" />
        </div>
      ) : error ? (
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-6 text-center">
          <p className="text-rose-400 text-sm">{error}</p>
          <button
            onClick={loadBooks}
            className="mt-3 px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs font-medium border border-rose-500/20 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Search className="w-8 h-8 text-slate-700 mx-auto" />
          <p className="text-slate-500 text-sm">
            {hasFilters ? 'No books match the current filters.' : 'No books found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {books.map((book) => (
            <button
              key={book.book_id}
              onClick={() => navigate(`/books/${book.book_id}`)}
              className="text-left bg-slate-900/50 border border-slate-700/30 rounded-xl p-4
                         hover:border-teal-500/40 hover:bg-slate-900/80
                         transition-all duration-150 group"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex-shrink-0 group-hover:bg-teal-500/20 transition-colors">
                  <BookOpen className="w-4 h-4 text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-200 leading-snug line-clamp-2" dir="rtl" lang="ar">
                    {book.book_name}
                  </h3>
                  {book.author && (
                    <p className="text-[11px] text-slate-500 mt-1 truncate" dir="rtl">
                      {book.author.name}
                    </p>
                  )}
                  {book.category && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 bg-slate-800/60 rounded-full text-[10px] text-slate-500 border border-slate-700/30">
                      {book.category.name}
                    </span>
                  )}
                  {book.num_pages && (
                    <p className="text-[10px] text-slate-600 mt-1">{book.num_pages} pages</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 rounded-lg text-xs text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                    p === page
                      ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40'
                      : 'text-slate-400 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/40 rounded-lg text-xs text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
