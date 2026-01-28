import { useState, useCallback, useMemo } from 'react'
import { useBooks, useExportedStatus } from '../hooks/useBooks'
import { useExportBooks } from '../hooks/useJobs'
import { fetchFilteredBookIds } from '../api/client'
import FilterBar from '../components/FilterBar'
import BookTable from '../components/BookTable'
import Pagination from '../components/Pagination'
import ExportDialog from '../components/ExportDialog'

const PAGE_SIZE = 50

export default function BooksPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [authorId, setAuthorId] = useState<number | undefined>()
  const [authorName, setAuthorName] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showExport, setShowExport] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)

  const { data, isLoading, isFetching } = useBooks({
    q: search || undefined,
    category_id: categoryId,
    author_id: authorId,
    printed: 1,
    has_toc: true,
    limit: PAGE_SIZE,
    offset,
  })

  const exportMutation = useExportBooks()

  const books = data?.books ?? []
  const bookIds = useMemo(() => books.map((b) => b.book_id), [books])
  const { data: exportedData } = useExportedStatus(bookIds)
  const exportedIds = useMemo(
    () => new Set(exportedData?.exported_ids ?? []),
    [exportedData]
  )
  const allSelected = books.length > 0 && books.every((b) => selectedIds.has(b.book_id))

  const handleSearchChange = useCallback((q: string) => {
    setSearch(q)
    setOffset(0)
  }, [])

  const handleCategoryChange = useCallback((id: number | undefined) => {
    setCategoryId(id)
    setOffset(0)
  }, [])

  const handleAuthorChange = useCallback((id: number | undefined, name: string) => {
    setAuthorId(id)
    setAuthorName(name)
    setOffset(0)
  }, [])

  function toggleBook(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        books.forEach((b) => next.delete(b.book_id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        books.forEach((b) => next.add(b.book_id))
        return next
      })
    }
  }

  const totalBooks = data?.pagination?.total ?? 0
  const allFilteredSelected = totalBooks > 0 && selectedIds.size === totalBooks

  function selectAllFiltered() {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
      return
    }
    setSelectingAll(true)
    fetchFilteredBookIds({
      q: search || undefined,
      category_id: categoryId,
      author_id: authorId,
      printed: 1,
      has_toc: true,
    })
      .then((res) => {
        setSelectedIds(new Set(res.book_ids))
      })
      .catch((err) => {
        console.error('Failed to fetch all book IDs:', err)
      })
      .finally(() => {
        setSelectingAll(false)
      })
  }

  function handleExport(useDeepinfra: boolean) {
    exportMutation.mutate(
      { bookIds: Array.from(selectedIds), useDeepinfra },
      {
        onSuccess: () => {
          setShowExport(false)
          setSelectedIds(new Set())
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">الكتب المتاحة</h1>
        <div className="flex items-center gap-3">
          {totalBooks > 0 && (
            <button
              onClick={selectAllFiltered}
              disabled={selectingAll}
              className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              {selectingAll
                ? 'جاري التحديد...'
                : allFilteredSelected
                  ? `إلغاء تحديد الكل (${totalBooks})`
                  : `تحديد الكل (${totalBooks})`}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowExport(true)}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              تصدير {selectedIds.size} كتاب
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <FilterBar
          onSearchChange={handleSearchChange}
          onCategoryChange={handleCategoryChange}
          onAuthorChange={handleAuthorChange}
          selectedCategoryId={categoryId}
          selectedAuthorId={authorId}
          selectedAuthorName={authorName}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <BookTable
          books={books}
          selectedIds={selectedIds}
          exportedIds={exportedIds}
          onToggle={toggleBook}
          onToggleAll={toggleAll}
          allSelected={allSelected}
          loading={isLoading}
        />
        {isFetching && !isLoading && (
          <div className="h-0.5 bg-blue-100">
            <div className="h-full bg-blue-500 animate-pulse w-full" />
          </div>
        )}
        <Pagination pagination={data?.pagination ?? null} onPageChange={setOffset} />
      </div>

      {/* Export dialog */}
      {showExport && (
        <ExportDialog
          selectedCount={selectedIds.size}
          onExport={handleExport}
          onClose={() => setShowExport(false)}
          loading={exportMutation.isPending}
        />
      )}
    </div>
  )
}
