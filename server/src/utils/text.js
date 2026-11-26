import slugifyLib from "slugify";

export function slugify(text) {
  const s = slugifyLib(String(text || ""), { lower: true, strict: true, trim: true });
  return s || "book";
}

const WORDS_PER_MINUTE = 230;
// Average adult reads a novel page in roughly 1.7 minutes (~300 words/page at ~180 wpm with pauses).
const MINUTES_PER_BOOK_PAGE = 1.7;

export function countWords(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .join(" ")
    .split(/\s+/)
    .filter(Boolean).length;
}

/** Minutes to read the summary itself. */
export function readingTimeMinutes(...parts) {
  return Math.max(1, Math.round(countWords(...parts) / WORDS_PER_MINUTE));
}

/** Rough hours a reader saves by reading the summary instead of the book. */
export function hoursSaved(pageCount, summaryMinutes = 0) {
  if (!pageCount) return null;
  const hours = (pageCount * MINUTES_PER_BOOK_PAGE - summaryMinutes) / 60;
  return Math.max(0, Math.round(hours * 10) / 10);
}

export function excerpt(text, max = 160) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, clean.lastIndexOf(" ", max - 1) || max - 1).trimEnd() + "…";
}
