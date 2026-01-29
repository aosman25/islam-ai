import type {
  BookListResponse,
  CategoryListResponse,
  AuthorListResponse,
  JobListResponse,
  Job,
  JobSubmitResponse,
  DeadLetterListResponse,
  DeleteBatchResponse,
} from '../types'

const BASE = ''

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init)
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error || body?.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export interface SearchBooksParams {
  q?: string
  category_id?: number
  author_id?: number
  printed?: number
  has_toc?: boolean
  exported?: boolean
  limit?: number
  offset?: number
}

function applySearchParams(sp: URLSearchParams, params: SearchBooksParams) {
  if (params.q) sp.set('q', params.q)
  if (params.category_id != null) sp.set('category_id', String(params.category_id))
  if (params.author_id != null) sp.set('author_id', String(params.author_id))
  if (params.printed != null) sp.set('printed', String(params.printed))
  if (params.has_toc != null) sp.set('has_toc', String(params.has_toc))
  if (params.exported != null) sp.set('exported', String(params.exported))
}

export function searchBooks(params: SearchBooksParams) {
  const sp = new URLSearchParams()
  applySearchParams(sp, params)
  if (params.limit != null) sp.set('limit', String(params.limit))
  if (params.offset != null) sp.set('offset', String(params.offset))
  return request<BookListResponse>(`/books/search?${sp}`)
}

export function fetchFilteredBookIds(params: Omit<SearchBooksParams, 'limit' | 'offset'>) {
  const sp = new URLSearchParams()
  applySearchParams(sp, params)
  return request<{ book_ids: number[]; total: number }>(`/books/ids?${sp}`)
}

export function fetchCategories(limit = 500) {
  return request<CategoryListResponse>(`/categories?limit=${limit}`)
}

export function searchCategories(q: string) {
  return request<CategoryListResponse>(`/categories/search?q=${encodeURIComponent(q)}`)
}

export function fetchAuthors(limit = 500) {
  return request<AuthorListResponse>(`/authors?limit=${limit}`)
}

export function searchAuthors(q: string) {
  return request<AuthorListResponse>(`/authors/search?q=${encodeURIComponent(q)}&limit=50`)
}

export function checkExportedBooks(bookIds: number[]) {
  return request<{ exported_ids: number[] }>('/books/exported', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_ids: bookIds }),
  })
}

export function exportBooks(bookIds: number[]) {
  return request<JobSubmitResponse>('/export/books', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_ids: bookIds }),
  })
}

export function fetchJobs(status?: string, limit = 50, offset = 0) {
  const sp = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (status) sp.set('status', status)
  return request<JobListResponse>(`/jobs?${sp}`)
}

export function fetchJob(jobId: string) {
  return request<Job>(`/jobs/${jobId}`)
}

export function fetchDLQ(limit = 50, offset = 0) {
  return request<DeadLetterListResponse>(`/jobs/dlq?limit=${limit}&offset=${offset}`)
}

export function retryDLQ(index: number) {
  return request<JobSubmitResponse>(`/jobs/dlq/${index}/retry`, { method: 'POST' })
}

export function clearDLQ() {
  return request<{ message: string }>('/jobs/dlq', { method: 'DELETE' })
}

export function deleteBooks(bookIds: number[]) {
  return request<DeleteBatchResponse>('/books', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book_ids: bookIds }),
  })
}
