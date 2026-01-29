import { useState, useEffect, useRef } from 'react'
import { useCategories } from '../hooks/useCategories'
import { useAuthorSearch } from '../hooks/useAuthors'

interface Props {
  onSearchChange: (q: string) => void
  onCategoryChange: (id: number | undefined) => void
  onAuthorChange: (id: number | undefined, name: string) => void
  onExportedChange: (exported: boolean | undefined) => void
  selectedCategoryId?: number
  selectedAuthorId?: number
  selectedAuthorName?: string
  selectedExported?: boolean
}

export default function FilterBar({
  onSearchChange,
  onCategoryChange,
  onAuthorChange,
  onExportedChange,
  selectedCategoryId,
  selectedAuthorId,
  selectedAuthorName,
  selectedExported,
}: Props) {
  const [searchText, setSearchText] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false)
  const authorRef = useRef<HTMLDivElement>(null)

  const { data: categoriesData } = useCategories()
  const { data: authorResults } = useAuthorSearch(authorQuery)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => onSearchChange(searchText), 300)
    return () => clearTimeout(t)
  }, [searchText, onSearchChange])

  // Close author dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (authorRef.current && !authorRef.current.contains(e.target as Node)) {
        setShowAuthorDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-slate-600 mb-1">بحث عن كتاب</label>
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="اكتب اسم الكتاب..."
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Category */}
      <div className="min-w-[180px]">
        <label className="block text-sm font-medium text-slate-600 mb-1">التصنيف</label>
        <select
          value={selectedCategoryId ?? ''}
          onChange={(e) => onCategoryChange(e.target.value ? Number(e.target.value) : undefined)}
          className="w-full h-[38px] px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">جميع التصنيفات</option>
          {categoriesData?.categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.category_name}
            </option>
          ))}
        </select>
      </div>

      {/* Author with autocomplete */}
      <div className="min-w-[200px] relative" ref={authorRef}>
        <label className="block text-sm font-medium text-slate-600 mb-1">المؤلف</label>
        {selectedAuthorId ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-300 bg-blue-50 text-sm">
            <span className="flex-1 truncate">{selectedAuthorName}</span>
            <button
              onClick={() => {
                onAuthorChange(undefined, '')
                setAuthorQuery('')
              }}
              className="text-blue-600 hover:text-blue-800 font-bold"
            >
              &times;
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={authorQuery}
            onChange={(e) => {
              setAuthorQuery(e.target.value)
              setShowAuthorDropdown(true)
            }}
            onFocus={() => authorQuery && setShowAuthorDropdown(true)}
            placeholder="ابحث عن مؤلف..."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        )}
        {showAuthorDropdown && authorResults && authorResults.authors.length > 0 && (
          <div className="absolute z-20 top-full mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {authorResults.authors.map((a) => (
              <button
                key={a.author_id}
                onClick={() => {
                  onAuthorChange(a.author_id, a.author_name ?? '')
                  setShowAuthorDropdown(false)
                  setAuthorQuery('')
                }}
                className="w-full text-right px-3 py-2 text-sm hover:bg-slate-100 border-b border-slate-100 last:border-0"
              >
                {a.author_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Exported filter */}
      <div className="min-w-[150px]">
        <label className="block text-sm font-medium text-slate-600 mb-1">حالة التصدير</label>
        <select
          value={selectedExported === undefined ? '' : selectedExported ? 'true' : 'false'}
          onChange={(e) => {
            const v = e.target.value
            onExportedChange(v === '' ? undefined : v === 'true')
          }}
          className="w-full h-[38px] px-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">الكل</option>
          <option value="true">تم التصدير</option>
          <option value="false">غير مصدّر</option>
        </select>
      </div>
    </div>
  )
}
