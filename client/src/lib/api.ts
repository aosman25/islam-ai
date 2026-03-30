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
} from "@/types";

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
// Books (Master Server)
// ============================================================

export async function getBooks(
  query: BooksQuery = {}
): Promise<PaginatedResponse<Book>> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.include_toc) params.set("include_toc", "true");
  if (query.author_ids?.length)
    params.set("author_ids", query.author_ids.join(","));
  if (query.category_ids?.length)
    params.set("category_ids", query.category_ids.join(","));
  if (query.search) params.set("search", query.search);
  return apiFetch<PaginatedResponse<Book>>(
    MASTER_BASE,
    `/books?${params.toString()}`
  );
}

export async function getBook(id: number): Promise<Book> {
  return apiFetch<Book>(MASTER_BASE, `/books/${id}?include_toc=true`);
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
  const all: Author[] = [];
  let page = 1;
  while (true) {
    const res = await apiFetch<PaginatedResponse<Author>>(
      MASTER_BASE,
      `/authors?limit=100&page=${page}`
    );
    all.push(...res.data);
    if (all.length >= res.total) break;
    page++;
  }
  return all;
}

export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>(MASTER_BASE, "/categories");
}
