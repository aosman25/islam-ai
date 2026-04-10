// ============================================================
// Core Data Types
// ============================================================

export interface Author {
  id: number;
  name: string;
  name_ar?: string;
}

export interface Category {
  id: number;
  name: string;
  name_ar?: string;
}

export interface Book {
  book_id: number;
  book_name: string;
  book_name_ar?: string;
  author_id: number;
  category_id: number;
  editor: string | null;
  edition: string | null;
  publisher: string | null;
  num_volumes: string | null;
  num_pages: string | null;
  shamela_pub_date: string | null;
  author_full: string | null;
  parts: unknown;
  table_of_contents: TocEntry[] | null;
  author?: Author;
  category?: Category;
}

export interface TocEntry {
  id: number;
  title: string;
  page_id: number;
  page_num: number;
  parent: number;
  parent_id?: number | null;
  level?: number;
  children?: TocEntry[];
}

export interface BookPage {
  book_id: number;
  page_id: number;
  part_title: string;
  page_num: number;
  display_elem: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// ============================================================
// Source / Citation Types
// ============================================================

export interface SourceData {
  distance: number;
  id: number;
  book_id: number;
  book_name: string;
  order: number;
  author: string;
  category: string;
  part_title: string;
  start_page_id: number;
  page_offset: number;
  page_num_range: number[];
  text: string;
}

// ============================================================
// Gateway / Chat Types
// ============================================================

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GatewayRequest {
  query: string;
  chat_history?: ChatHistoryMessage[];
  top_k?: number;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  athar_mode?: boolean;
  reranker?: "RRF" | "Weighted";
  reranker_params?: number | number[];
}

export interface GatewayResponse {
  response: string;
  sources: SourceData[];
  hypothetical_passages: string[];
  categories: string[];
  request_id: string;
}

export interface GatewayStreamChunk {
  type: "metadata" | "content" | "done";
  delta?: string;
  sources?: SourceData[];
  hypothetical_passages?: string[];
  categories?: string[];
  request_id?: string;
  is_triage?: boolean;
}

// ============================================================
// Chat State Types
// ============================================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceData[];
  categories?: string[];
  timestamp: number;
  isStreaming?: boolean;
  streamPhase?: "searching" | "reading" | "generating";
  streamStartedAt?: number;
  is_triage?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  hasMoreMessages?: boolean;
}

// ============================================================
// Source Reference (lightweight, stored in DB)
// ============================================================

export interface SourceRef {
  chunk_id: number;
  distance: number;
}

// ============================================================
// Conversation API Types
// ============================================================

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationsPage {
  data: ConversationSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ApiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  is_triage?: boolean;
}

export interface ConversationDetail {
  id: string;
  user_id: string;
  title: string;
  messages: ApiMessage[];
  totalMessages: number;
  hasMoreMessages: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Search Types
// ============================================================

export interface BooksQuery {
  page?: number;
  limit?: number;
  include_toc?: boolean;
  category_ids?: number[];
  author_ids?: number[];
  search?: string;
}

// ============================================================
// Health Types
// ============================================================

export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
}
