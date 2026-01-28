import type { PaginationMeta } from '../types'

interface Props {
  pagination: PaginationMeta | null
  onPageChange: (offset: number) => void
}

export default function Pagination({ pagination, onPageChange }: Props) {
  if (!pagination) return null

  const { total, limit, offset } = pagination
  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <div className="text-sm text-slate-500">
        عرض {offset + 1} - {Math.min(offset + limit, total)} من {total}
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          السابق
        </button>
        <span className="px-3 py-1.5 text-sm text-slate-600">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(offset + limit)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          التالي
        </button>
      </div>
    </div>
  )
}
