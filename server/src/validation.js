import { z } from "zod";
import { SHELVES } from "./models/User.js";
import { VERDICTS } from "./models/Book.js";

const trimmed = (max) => z.string().trim().max(max);
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Must be a link starting with http:// or https://");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "3–24 characters: letters, numbers or underscores"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(128),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  bio: trimmed(280).optional(),
  avatarUrl: optionalUrl.optional(),
});

export const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "At least 8 characters").max(128),
});

const currentYear = new Date().getFullYear();

export const bookFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  author: trimmed(120).default(""),
  genres: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
  publishedYear: z.coerce.number().int().min(-3000).max(currentYear + 1).nullable().optional(),
  pageCount: z.coerce.number().int().min(1).max(20000).nullable().optional(),
  coverUrl: optionalUrl.default(""),
  theme: z.string().trim().min(10, "Write at least a sentence").max(600),
  keyPoints: z.array(z.string().trim().min(1).max(400)).max(20).default([]),
  summary: z.string().trim().min(50, "The summary needs at least 50 characters").max(60000),
  spoilers: trimmed(20000).default(""),
  verdict: z.enum(VERDICTS).default("skip"),
  verdictReason: trimmed(400).default(""),
};

export const bookCreateSchema = z.object(bookFields);
// For edits every field is optional, and defaults must not fill in missing fields.
export const bookUpdateSchema = z
  .object(
    Object.fromEntries(
      Object.entries(bookFields).map(([k, v]) => [k, (v instanceof z.ZodDefault ? v.removeDefault() : v).optional()])
    )
  )
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Change at least one field");

export const editRequestSchema = z.object({
  changes: bookUpdateSchema,
  message: trimmed(1000).default(""),
});

export const reviewSchema = z.object({
  note: trimmed(1000).default(""),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(2000),
  parent: z.string().regex(/^[a-f0-9]{24}$/).nullable().optional(),
});

export const ratingSchema = z.object({ value: z.coerce.number().int().min(1).max(5) });
export const shelfSchema = z.object({ shelf: z.enum(SHELVES).nullable() });

export const listQuerySchema = z.object({
  q: trimmed(100).optional(),
  genre: trimmed(30).optional(),
  verdict: z.enum(VERDICTS).optional(),
  author: trimmed(120).optional(),
  sort: z.enum(["newest", "oldest", "popular", "top", "title"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(48).default(12),
});

export const aiDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  author: trimmed(120).default(""),
});
