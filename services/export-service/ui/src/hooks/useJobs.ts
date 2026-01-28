import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchJobs, fetchJob, exportBooks, fetchDLQ, retryDLQ, clearDLQ } from '../api/client'

export function useJobs(status?: string) {
  return useQuery({
    queryKey: ['jobs', status],
    queryFn: () => fetchJobs(status),
    refetchInterval: 5000,
  })
}

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => fetchJob(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const s = query.state.data?.status
      if (s === 'pending' || s === 'in_progress') return 3000
      return false
    },
  })
}

export function useExportBooks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bookIds, useDeepinfra }: { bookIds: number[]; useDeepinfra: boolean }) =>
      exportBooks(bookIds, useDeepinfra),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

export function useDLQ() {
  return useQuery({
    queryKey: ['dlq'],
    queryFn: () => fetchDLQ(),
    refetchInterval: 10000,
  })
}

export function useRetryDLQ() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (index: number) => retryDLQ(index),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dlq'] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}

export function useClearDLQ() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: clearDLQ,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dlq'] })
    },
  })
}
