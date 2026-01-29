import { useState, useCallback, useMemo } from 'react'
import { useBooks, useExportedStatus } from '../hooks/useBooks'
import { useExportBooks, useDeleteBooks } from '../hooks/useJobs'
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
  const [exported, setExported] = useState<boolean | undefined>()
  const [offset, setOffset] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showExport, setShowExport] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectingAll, setSelectingAll] = useState(false)

  const { data, isLoading, isFetching } = useBooks({
    q: search || undefined,
    category_id: categoryId,
    author_id: authorId,
    printed: 1,
    has_toc: true,
    exported,
    limit: PAGE_SIZE,
    offset,
  })

  const exportMutation = useExportBooks()
  const deleteMutation = useDeleteBooks()

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

  const handleExportedChange = useCallback((value: boolean | undefined) => {
    setExported(value)
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
      exported,
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

  function handleDelete() {
    deleteMutation.mutate(Array.from(selectedIds), {
      onSuccess: () => {
        setShowDeleteConfirm(false)
        setSelectedIds(new Set())
      },
    })
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
            <>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
              >
                حذف {selectedIds.size} كتاب
              </button>
              <button
                onClick={() => setShowExport(true)}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
              >
                تصدير {selectedIds.size} كتاب
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <FilterBar
          onSearchChange={handleSearchChange}
          onCategoryChange={handleCategoryChange}
          onAuthorChange={handleAuthorChange}
          onExportedChange={handleExportedChange}
          selectedCategoryId={categoryId}
          selectedAuthorId={authorId}
          selectedAuthorName={authorName}
          selectedExported={exported}
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

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4 space-y-4">
            <h2 className="text-lg font-bold text-slate-800">تأكيد الحذف</h2>
            <p className="text-sm text-slate-600">
              هل أنت متأكد من حذف <span className="font-bold text-red-600">{selectedIds.size}</span> كتاب؟
              سيتم حذف البيانات من S3 و PostgreSQL و Milvus. هذا الإجراء لا يمكن التراجع عنه.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
