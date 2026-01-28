import type { Book } from '../types'

interface Props {
  books: Book[]
  selectedIds: Set<number>
  exportedIds: Set<number>
  onToggle: (id: number) => void
  onToggleAll: () => void
  allSelected: boolean
  loading?: boolean
}

export default function BookTable({ books, selectedIds, exportedIds, onToggle, onToggleAll, allSelected, loading }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="px-4 py-3 text-right w-10">
              <input
                type="checkbox"
                checked={allSelected && books.length > 0}
                onChange={onToggleAll}
                className="w-4 h-4 rounded border-slate-300 accent-blue-600"
              />
            </th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">رقم الكتاب</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">اسم الكتاب</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">المؤلف</th>
            <th className="px-4 py-3 text-right font-semibold text-slate-600">التصنيف</th>
            <th className="px-4 py-3 text-center font-semibold text-slate-600">حالة التصدير</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                جاري التحميل...
              </td>
            </tr>
          ) : books.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                لا توجد نتائج
              </td>
            </tr>
          ) : (
            books.map((book) => {
              const exported = exportedIds.has(book.book_id)
              return (
                <tr
                  key={book.book_id}
                  onClick={() => onToggle(book.book_id)}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${
                    selectedIds.has(book.book_id) ? 'bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(book.book_id)}
                      onChange={() => onToggle(book.book_id)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{book.book_id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{book.book_name}</td>
                  <td className="px-4 py-3 text-slate-600">{book.author_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{book.category_name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {exported ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        تم التصدير
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        غير مصدّر
                      </span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
