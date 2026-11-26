import mongoose from "mongoose";
import { slugify, readingTimeMinutes, hoursSaved } from "../utils/text.js";

export const VERDICTS = ["skip", "skim", "read"];
export const STATUSES = ["pending", "published", "rejected"];
// Fields a writer controls. Used for create, direct edits and edit requests.
export const EDITABLE_FIELDS = [
  "title",
  "author",
  "genres",
  "publishedYear",
  "pageCount",
  "coverUrl",
  "theme",
  "keyPoints",
  "summary",
  "spoilers",
  "verdict",
  "verdictReason",
];

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, index: true },
    author: { type: String, trim: true, maxlength: 120, default: "" },
    genres: { type: [String], default: [], index: true },
    publishedYear: { type: Number },
    pageCount: { type: Number },
    coverUrl: { type: String, default: "" },
    // One or two sentence "what it's really about".
    theme: { type: String, required: true, maxlength: 600 },
    keyPoints: { type: [String], default: [] },
    summary: { type: String, required: true },
    // Ending / twists, hidden behind a toggle in the UI.
    spoilers: { type: String, default: "" },
    verdict: { type: String, enum: VERDICTS, default: "skip" },
    verdictReason: { type: String, maxlength: 400, default: "" },

    status: { type: String, enum: STATUSES, default: "pending", index: true },
    rejectionReason: { type: String, default: "" },
    featured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    publishedAt: { type: Date },

    readingTime: { type: Number, default: 1 },
    hoursSaved: { type: Number, default: null },

    likes: { type: [mongoose.Schema.Types.ObjectId], default: [], select: false },
    likesCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
  },
  { timestamps: true }
);

bookSchema.index({ status: 1, publishedAt: -1 });
bookSchema.index({ title: "text", author: "text", theme: "text", genres: "text" }, { weights: { title: 10, author: 5, genres: 3, theme: 1 } });

bookSchema.pre("validate", function derive() {
  if (this.isModified("genres")) {
    this.genres = [...new Set(this.genres.map((g) => g.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
  }
  if (this.isModified("keyPoints")) {
    this.keyPoints = this.keyPoints.map((k) => k.trim()).filter(Boolean);
  }
  this.readingTime = readingTimeMinutes(this.theme, this.keyPoints, this.summary, this.spoilers);
  this.hoursSaved = hoursSaved(this.pageCount, this.readingTime);
  if (this.status === "published" && !this.publishedAt) this.publishedAt = new Date();
});

/** Finds a free slug for a title, ignoring the given book id. */
bookSchema.statics.uniqueSlug = async function uniqueSlug(title, ignoreId) {
  const base = slugify(title).slice(0, 80);
  let candidate = base;
  for (let i = 2; ; i += 1) {
    const clash = await this.exists({ slug: candidate, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) });
    if (!clash) return candidate;
    candidate = `${base}-${i}`;
  }
};

export default mongoose.model("Book", bookSchema);
