import { useQuery } from '@tanstack/react-query'
import { searchBooks, checkExportedBooks, type SearchBooksParams } from '../api/client'

export function useBooks(params: SearchBooksParams) {
  return useQuery({
    queryKey: ['books', params],
    queryFn: () => searchBooks(params),
    placeholderData: (prev) => prev,
  })
}

export function useExportedStatus(bookIds: number[]) {
  return useQuery({
    queryKey: ['exported-status', bookIds],
    queryFn: () => checkExportedBooks(bookIds),
    enabled: bookIds.length > 0,
    placeholderData: (prev) => prev,
  })
}
