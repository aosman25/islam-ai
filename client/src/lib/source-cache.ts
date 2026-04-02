import type { SourceData } from "@/types";

const CACHE_PREFIX = "athars-source-";

export function cacheSource(source: SourceData) {
  try {
    sessionStorage.setItem(
      `${CACHE_PREFIX}${source.id}`,
      JSON.stringify(source)
    );
  } catch {
    // sessionStorage full — evict oldest entries
    evictOldest(10);
    try {
      sessionStorage.setItem(
        `${CACHE_PREFIX}${source.id}`,
        JSON.stringify(source)
      );
    } catch {
      // still full, give up silently
    }
  }
}

export function cacheSources(sources: SourceData[]) {
  for (const s of sources) {
    cacheSource(s);
  }
}

export function getCachedSource(chunkId: number): SourceData | null {
  const raw = sessionStorage.getItem(`${CACHE_PREFIX}${chunkId}`);
  return raw ? JSON.parse(raw) : null;
}

export function getCachedSources(
  chunkIds: number[]
): { cached: SourceData[]; missing: number[] } {
  const cached: SourceData[] = [];
  const missing: number[] = [];
  for (const id of chunkIds) {
    const s = getCachedSource(id);
    if (s) cached.push(s);
    else missing.push(id);
  }
  return { cached, missing };
}

function evictOldest(count: number) {
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
  }
  // Remove first N (oldest inserted)
  for (let i = 0; i < Math.min(count, keys.length); i++) {
    sessionStorage.removeItem(keys[i]);
  }
}
