import { useQuery } from '@tanstack/react-query'
import { searchAuthors } from '../api/client'

export function useAuthorSearch(q: string) {
  return useQuery({
    queryKey: ['authors-search', q],
    queryFn: () => searchAuthors(q),
    enabled: q.length > 0,
    staleTime: 60_000,
  })
}
