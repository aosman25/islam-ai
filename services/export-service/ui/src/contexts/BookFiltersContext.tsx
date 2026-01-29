import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

interface BookFilters {
  search: string
  categoryId: number | undefined
  authorId: number | undefined
  authorName: string
  exported: boolean | undefined
  offset: number
  selectedIds: Set<number>
}

interface BookFiltersContextValue extends BookFilters {
  setSearch: (q: string) => void
  setCategoryId: (id: number | undefined) => void
  setAuthor: (id: number | undefined, name: string) => void
  setExported: (value: boolean | undefined) => void
  setOffset: (offset: number) => void
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<number>>>
}

const BookFiltersContext = createContext<BookFiltersContextValue | null>(null)

export function BookFiltersProvider({ children }: { children: ReactNode }) {
  const [search, setSearchRaw] = useState('')
  const [categoryId, setCategoryIdRaw] = useState<number | undefined>()
  const [authorId, setAuthorId] = useState<number | undefined>()
  const [authorName, setAuthorName] = useState('')
  const [exported, setExportedRaw] = useState<boolean | undefined>()
  const [offset, setOffset] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const setSearch = useCallback((q: string) => {
    setSearchRaw(q)
    setOffset(0)
  }, [])

  const setCategoryId = useCallback((id: number | undefined) => {
    setCategoryIdRaw(id)
    setOffset(0)
  }, [])

  const setAuthor = useCallback((id: number | undefined, name: string) => {
    setAuthorId(id)
    setAuthorName(name)
    setOffset(0)
  }, [])

  const setExported = useCallback((value: boolean | undefined) => {
    setExportedRaw(value)
    setOffset(0)
  }, [])

  return (
    <BookFiltersContext.Provider
      value={{
        search, categoryId, authorId, authorName, exported, offset, selectedIds,
        setSearch, setCategoryId, setAuthor, setExported, setOffset, setSelectedIds,
      }}
    >
      {children}
    </BookFiltersContext.Provider>
  )
}

export function useBookFilters() {
  const ctx = useContext(BookFiltersContext)
  if (!ctx) throw new Error('useBookFilters must be used within BookFiltersProvider')
  return ctx
}
