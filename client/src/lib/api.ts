import type {
  Book,
  BookPage,
  BooksQuery,
  PaginatedResponse,
  Author,
  Category,
  GatewayRequest,
  GatewayStreamChunk,
  HealthResponse,
  SourceData,
  ConversationsPage,
  ConversationDetail,
} from "@/types";
import { normalizeSearch } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8100";
const MASTER_BASE = process.env.NEXT_PUBLIC_MASTER_BASE_URL || "http://localhost:8200";

// ============================================================
// Generic fetch helper
// ============================================================

async function apiFetch<T>(
  base: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// ============================================================
// Gateway (RAG Chat)
// ============================================================

export async function gatewayQuery(
  request: GatewayRequest,
  onChunk: (chunk: GatewayStreamChunk) => void,
  onError: (error: Error) => void,
  onComplete: () => void,
  signal?: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Response body is not readable");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onComplete();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line) as GatewayStreamChunk;
            onChunk(chunk);
          } catch {
            // skip unparseable lines
          }
        }
      }
    }
  } catch (error) {
    onError(error as Error);
  }
}

export async function gatewayHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>(API_BASE, "/health");
}

// ============================================================
// Chunks (via Gateway → Search Service)
// ============================================================

export async function fetchChunks(
  chunkIds: number[]
): Promise<SourceData[]> {
  const data = await apiFetch<{ chunks: SourceData[]; count: number }>(
    API_BASE,
    "/chunks",
    {
      method: "POST",
      body: JSON.stringify({ chunk_ids: chunkIds }),
    }
  );
  return data.chunks;
}

// ============================================================
// Conversations (Master Server)
// ============================================================

function authHeaders(userId: string): HeadersInit {
  return { Authorization: `Bearer ${userId}` };
}

export async function getConversations(
  userId: string,
  opts: { limit?: number; cursor?: string } = {}
): Promise<ConversationsPage> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.cursor) params.set("cursor", opts.cursor);
  const qs = params.toString();
  return apiFetch<ConversationsPage>(
    MASTER_BASE,
    `/conversations${qs ? `?${qs}` : ""}`,
    { headers: authHeaders(userId) }
  );
}

export async function getConversation(
  userId: string,
  id: string,
  opts: { messagesLimit?: number; before?: number } = {}
): Promise<ConversationDetail> {
  const params = new URLSearchParams();
  if (opts.messagesLimit) params.set("messages_limit", String(opts.messagesLimit));
  if (opts.before) params.set("before", String(opts.before));
  const qs = params.toString();
  return apiFetch<ConversationDetail>(
    MASTER_BASE,
    `/conversations/${id}${qs ? `?${qs}` : ""}`,
    { headers: authHeaders(userId) }
  );
}

export async function createConversation(
  userId: string,
  data: { title?: string; messages?: unknown[] }
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(MASTER_BASE, "/conversations", {
    method: "POST",
    body: JSON.stringify(data),
    headers: authHeaders(userId),
  });
}

export async function updateConversationTitle(
  userId: string,
  id: string,
  title: string
): Promise<void> {
  await apiFetch(MASTER_BASE, `/conversations/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
    headers: authHeaders(userId),
  });
}

export async function deleteConversation(
  userId: string,
  id: string
): Promise<void> {
  await apiFetch(MASTER_BASE, `/conversations/${id}`, {
    method: "DELETE",
    headers: authHeaders(userId),
  });
}

export async function addMessages(
  userId: string,
  conversationId: string,
  messages: unknown[]
): Promise<void> {
  await apiFetch(MASTER_BASE, `/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify(messages),
    headers: authHeaders(userId),
  });
}


// ============================================================
// Local JSON data cache
// ============================================================

interface RawBook {
  book_name: string;
  book_name_ar: string;
  editor: string | null;
  editor_ar: string | null;
  edition: string | null;
  edition_ar: string | null;
  publisher: string | null;
  publisher_ar: string | null;
  shamela_pub_date: string | null;
  shamela_pub_date_ar: string | null;
  author_full: string | null;
  author_full_ar: string | null;
  category_id: number;
  author_id: number;
  num_pages: string | null;
  num_volumes: string | null;
}

interface RawAuthor {
  name: string;
  name_ar: string;
}

interface RawCategory {
  name: string;
  name_ar: string;
}

let booksCache: Record<string, RawBook> | null = null;
let authorsCache: Record<string, RawAuthor> | null = null;
let categoriesCache: Record<string, RawCategory> | null = null;

async function loadBooks(): Promise<Record<string, RawBook>> {
  if (!booksCache) {
    const res = await fetch("/data/books_transliteration.json");
    booksCache = await res.json();
  }
  return booksCache!;
}

async function loadAuthors(): Promise<Record<string, RawAuthor>> {
  if (!authorsCache) {
    const res = await fetch("/data/authors_transliteration.json");
    authorsCache = await res.json();
  }
  return authorsCache!;
}

async function loadCategories(): Promise<Record<string, RawCategory>> {
  if (!categoriesCache) {
    const res = await fetch("/data/categories.json");
    categoriesCache = await res.json();
  }
  return categoriesCache!;
}

// ============================================================
// Books (Local JSON)
// ============================================================

export async function getBooks(
  query: BooksQuery = {}
): Promise<PaginatedResponse<Book>> {
  const [rawBooks, rawAuthors, rawCategories] = await Promise.all([
    loadBooks(),
    loadAuthors(),
    loadCategories(),
  ]);

  let entries = Object.entries(rawBooks).map(([id, raw]) => {
    const author = rawAuthors[String(raw.author_id)];
    const category = rawCategories[String(raw.category_id)];
    return {
      book_id: Number(id),
      book_name: raw.book_name,
      book_name_ar: raw.book_name_ar,
      author_id: raw.author_id,
      category_id: raw.category_id,
      editor: raw.editor,
      edition: raw.edition,
      publisher: raw.publisher,
      num_volumes: raw.num_volumes,
      num_pages: raw.num_pages,
      shamela_pub_date: raw.shamela_pub_date,
      author_full: raw.author_full,
      parts: null,
      table_of_contents: null,
      author: author ? { id: raw.author_id, name: author.name, name_ar: author.name_ar } : undefined,
      category: category ? { id: raw.category_id, name: category.name, name_ar: category.name_ar } : undefined,
    } as Book;
  });

  // Filter by search
  if (query.search) {
    const s = normalizeSearch(query.search);
    entries = entries.filter(
      (b) =>
        normalizeSearch(b.book_name ?? "").includes(s) ||
        normalizeSearch(b.book_name_ar ?? "").includes(s)
    );
  }

  // Filter by author
  if (query.author_ids?.length) {
    const ids = new Set(query.author_ids);
    entries = entries.filter((b) => ids.has(b.author_id));
  }

  // Filter by category
  if (query.category_ids?.length) {
    const ids = new Set(query.category_ids);
    entries = entries.filter((b) => ids.has(b.category_id));
  }

  const total = entries.length;
  const page = query.page || 1;
  const limit = query.limit || 20;
  const start = (page - 1) * limit;
  const data = entries.slice(start, start + limit);

  return { data, total, page, limit };
}

export async function getBook(id: number): Promise<Book> {
  const [rawBooks, rawAuthors, rawCategories, toc] = await Promise.all([
    loadBooks(),
    loadAuthors(),
    loadCategories(),
    apiFetch<{ table_of_contents: unknown; parts: unknown }>(MASTER_BASE, `/books/${id}/toc`),
  ]);
  const raw = rawBooks[String(id)];
  if (!raw) throw new Error(`Book ${id} not found`);
  const author = rawAuthors[String(raw.author_id)];
  const category = rawCategories[String(raw.category_id)];
  return {
    book_id: id,
    book_name: raw.book_name,
    book_name_ar: raw.book_name_ar,
    author_id: raw.author_id,
    category_id: raw.category_id,
    editor: raw.editor,
    edition: raw.edition,
    publisher: raw.publisher,
    num_volumes: raw.num_volumes,
    num_pages: raw.num_pages,
    shamela_pub_date: raw.shamela_pub_date,
    author_full: raw.author_full,
    parts: toc.parts,
    table_of_contents: toc.table_of_contents as Book["table_of_contents"],
    author: author ? { id: raw.author_id, name: author.name, name_ar: author.name_ar } : undefined,
    category: category ? { id: raw.category_id, name: category.name, name_ar: category.name_ar } : undefined,
  } as Book;
}

export async function getBookPages(
  bookId: number,
  opts: {
    page?: number;
    offset?: number;
    startPageId?: number;
    limit?: number;
  } = {}
): Promise<PaginatedResponse<BookPage> & { offset: number }> {
  const { page = 1, offset, startPageId, limit = 20 } = opts;
  const params = new URLSearchParams({ limit: String(limit) });
  if (startPageId != null) params.set("start_page_id", String(startPageId));
  else if (offset != null) params.set("offset", String(offset));
  else params.set("page", String(page));
  return apiFetch<PaginatedResponse<BookPage> & { offset: number }>(
    MASTER_BASE,
    `/books/${bookId}/pages?${params}`
  );
}

export async function getAuthors(): Promise<Author[]> {
  const raw = await loadAuthors();
  return Object.entries(raw)
    .filter(([, a]) => a.name)
    .map(([id, a]) => ({ id: Number(id), name: a.name, name_ar: a.name_ar }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCategories(): Promise<Category[]> {
  const raw = await loadCategories();
  return Object.entries(raw)
    .map(([id, c]) => ({ id: Number(id), name: c.name, name_ar: c.name_ar }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
