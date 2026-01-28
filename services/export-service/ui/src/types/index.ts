export interface PaginationMeta {
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export interface Category {
  category_id: number
  category_name: string | null
  category_order: number | null
}

export interface Author {
  author_id: number
  author_name: string | null
  death_number: number | null
  death_text: string | null
  alpha: number | null
}

export interface Book {
  book_id: number
  book_name: string | null
  book_category: number | null
  book_type: number | null
  book_date: number | null
  authors: string | null
  main_author: number | null
  printed: number | null
  group_id: number | null
  hidden: number | null
  category_name: string | null
  author_name: string | null
}

export interface BookListResponse {
  books: Book[]
  count: number
  pagination: PaginationMeta | null
}

export interface CategoryListResponse {
  categories: Category[]
  count: number
  pagination: PaginationMeta | null
}

export interface AuthorListResponse {
  authors: Author[]
  count: number
  pagination: PaginationMeta | null
}

export type JobStatusType =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'completed_with_errors'
  | 'failed'

export type BookJobStatusType = 'pending' | 'in_progress' | 'completed' | 'failed'

export interface BookJobResult {
  book_id: number
  status: BookJobStatusType
  raw_files_count: number | null
  metadata_url: string | null
  error: string | null
  started_at: string | null
  completed_at: string | null
}

export interface Job {
  job_id: string
  status: JobStatusType
  total_books: number
  completed_books: number
  failed_books: number
  progress: number
  books: BookJobResult[]
  created_at: string
  updated_at: string
}

export interface JobListResponse {
  jobs: Job[]
  total: number
}

export interface JobSubmitResponse {
  job_id: string
  message: string
}

export interface DeadLetterEntry {
  job_id: string
  book_id: number
  error: string
  failed_at: string
}

export interface DeadLetterListResponse {
  entries: DeadLetterEntry[]
  total: number
}
