import Book, { EDITABLE_FIELDS } from "../models/Book.js";
import { Rating } from "../models/social.js";
import { isAdmin } from "../middleware/auth.js";
import { excerpt } from "../utils/text.js";

export const CARD_FIELDS =
  "title slug author genres coverUrl theme verdict readingTime hoursSaved likesCount ratingAvg ratingCount commentsCount views publishedAt status featured createdBy";

const authorOf = (u) => (u && u.username ? { username: u.username, name: u.name, avatarUrl: u.avatarUrl } : null);

export function toCard(book) {
  return {
    id: book._id,
    title: book.title,
    slug: book.slug,
    author: book.author,
    genres: book.genres,
    coverUrl: book.coverUrl,
    theme: excerpt(book.theme, 180),
    verdict: book.verdict,
    readingTime: book.readingTime,
    hoursSaved: book.hoursSaved,
    likesCount: book.likesCount,
    ratingAvg: Math.round((book.ratingAvg || 0) * 10) / 10,
    ratingCount: book.ratingCount,
    commentsCount: book.commentsCount,
    status: book.status,
    featured: book.featured,
    publishedAt: book.publishedAt,
    writer: authorOf(book.createdBy),
  };
}

export async function toDetail(book, viewer) {
  const base = {
    ...toCard(book),
    theme: book.theme,
    publishedYear: book.publishedYear ?? null,
    pageCount: book.pageCount ?? null,
    keyPoints: book.keyPoints,
    summary: book.summary,
    spoilers: book.spoilers,
    verdictReason: book.verdictReason,
    rejectionReason: book.rejectionReason,
    views: book.views,
    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
  };
  if (!viewer) return { ...base, viewer: null };

  const [liked, rating] = await Promise.all([
    Book.exists({ _id: book._id, likes: viewer._id }),
    Rating.findOne({ book: book._id, user: viewer._id }).lean(),
  ]);
  const shelfItem = viewer.library.find((i) => String(i.book) === String(book._id));
  const isOwner = book.createdBy && String(book.createdBy._id ?? book.createdBy) === String(viewer._id);

  return {
    ...base,
    viewer: {
      liked: Boolean(liked),
      bookmarked: viewer.bookmarks.some((b) => String(b) === String(book._id)),
      shelf: shelfItem?.shelf ?? null,
      rating: rating?.value ?? null,
      // Admins edit directly. Owners can edit their own summaries until published.
      canEdit: isAdmin(viewer) || (isOwner && book.status !== "published"),
      canDelete: isAdmin(viewer) || (isOwner && book.status !== "published"),
      canSuggestEdit: !isAdmin(viewer) && book.status === "published",
      isOwner,
    },
  };
}

/** Copies only editable fields from validated input onto a book document. */
export function applyFields(book, input) {
  for (const field of EDITABLE_FIELDS) {
    if (input[field] !== undefined) book[field] = input[field];
  }
}

/** Snapshot of the given fields' current values, for edit-request diffs. */
export function snapshot(book, fields) {
  const out = {};
  for (const f of fields) {
    const v = book[f];
    out[f] = Array.isArray(v) ? [...v] : v ?? null;
  }
  return out;
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Drops fields whose proposed value equals the current value. */
export function diffChanges(book, changes) {
  const out = {};
  for (const [k, v] of Object.entries(changes)) {
    const current = Array.isArray(book[k]) ? [...book[k]] : book[k];
    if (!same(current, v)) out[k] = v;
  }
  return out;
}
