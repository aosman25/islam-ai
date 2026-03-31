import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Detect text direction based on content.
 * Returns "rtl" for Arabic/Hebrew/Persian, "ltr" otherwise.
 */
export function detectDirection(text: string): "rtl" | "ltr" {
  const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  const sample = text.slice(0, 200);
  let rtlCount = 0;
  let ltrCount = 0;
  for (const char of sample) {
    if (rtlChars.test(char)) rtlCount++;
    else if (/[a-zA-Z]/.test(char)) ltrCount++;
  }
  return rtlCount > ltrCount ? "rtl" : "ltr";
}

/**
 * Generate a unique ID for chat messages
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format a timestamp for display
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/**
 * Truncate a string with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "\u2026";
}

/**
 * Debounce helper
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Normalize Arabic text for search comparison.
 * Unifies letter variants (e.g. أإآ → ا, ة → ه, ى → ي) and strips diacritics/tatweel.
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "") // diacritics (tashkeel)
    .replace(/\u0640/g, "")               // tatweel
    .trim()
    .toLowerCase();
}
