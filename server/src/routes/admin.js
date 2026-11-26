import { Router } from "express";
import mongoose from "mongoose";
import Book from "../models/Book.js";
import User from "../models/User.js";
import { Comment, EditRequest } from "../models/social.js";
import { requireAdmin } from "../middleware/auth.js";
import { applyFields, CARD_FIELDS, toCard, toDetail } from "../services/books.js";
import { asyncHandler, badRequest, escapeRegex, notFound } from "../utils/http.js";
import { bookUpdateSchema, reviewSchema } from "../validation.js";
import { z } from "zod";

const router = Router();
router.use(requireAdmin);

const byId = async (Model, id, label) => {
  if (!mongoose.isValidObjectId(id)) throw notFound(`${label} not found.`);
  const doc = await Model.findById(id);
  if (!doc) throw notFound(`${label} not found.`);
  return doc;
};

router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const [published, pendingBooks, pendingEdits, users, comments, views] = await Promise.all([
      Book.countDocuments({ status: "published" }),
      Book.countDocuments({ status: "pending" }),
      EditRequest.countDocuments({ status: "pending" }),
      User.countDocuments(),
      Comment.countDocuments({ deleted: false }),
      Book.aggregate([{ $group: { _id: null, views: { $sum: "$views" } } }]),
    ]);
    res.json({ published, pendingBooks, pendingEdits, users, comments, views: views[0]?.views ?? 0 });
  })
);

// ---------- Submissions ----------

router.get(
  "/books",
  asyncHandler(async (req, res) => {
    const status = z.enum(["pending", "published", "rejected"]).default("pending").parse(req.query.status);
    const books = await Book.find({ status })
      .select(`${CARD_FIELDS} rejectionReason updatedAt`)
      .populate("createdBy", "username name avatarUrl")
      .sort(status === "pending" ? { createdAt: 1 } : { updatedAt: -1 })
      .limit(200);
    res.json({ books: books.map((b) => ({ ...toCard(b), rejectionReason: b.rejectionReason, updatedAt: b.updatedAt })) });
  })
);

router.post(
  "/books/:id/approve",
  asyncHandler(async (req, res) => {
    const book = await byId(Book, req.params.id, "Summary");
    // The admin may tweak the submission while approving it.
    if (req.body?.changes) {
      const changes = bookUpdateSchema.parse(req.body.changes);
      applyFields(book, changes);
      if (changes.title !== undefined) book.slug = await Book.uniqueSlug(changes.title, book._id);
    }
    book.status = "published";
    book.rejectionReason = "";
    await book.save();
    res.json({ book: toCard(book) });
  })
);

router.post(
  "/books/:id/reject",
  asyncHandler(async (req, res) => {
    const book = await byId(Book, req.params.id, "Summary");
    const { note } = reviewSchema.parse(req.body ?? {});
    if (!note) throw badRequest("Tell the writer why, so they can fix it.", { note: "Required" });
    book.status = "rejected";
    book.rejectionReason = note;
    book.featured = false;
    await book.save();
    res.json({ book: toCard(book) });
  })
);

router.post(
  "/books/:id/feature",
  asyncHandler(async (req, res) => {
    const book = await byId(Book, req.params.id, "Summary");
    if (book.status !== "published") throw badRequest("Only live summaries can be featured.");
    book.featured = !book.featured;
    await book.save();
    res.json({ featured: book.featured });
  })
);

// ---------- Edit requests ----------

const toRequest = (r) => ({
  id: r._id,
  status: r.status,
  message: r.message,
  changes: r.changes,
  original: r.original,
  reviewNote: r.reviewNote,
  createdAt: r.createdAt,
  reviewedAt: r.reviewedAt,
  // True when the summary was edited after this suggestion was made.
  stale: Boolean(r.book && r.bookUpdatedAt && new Date(r.book.updatedAt) > new Date(r.bookUpdatedAt)),
  book: r.book ? { id: r.book._id, title: r.book.title, slug: r.book.slug } : null,
  requestedBy: r.requestedBy ? { username: r.requestedBy.username, name: r.requestedBy.name } : null,
});

router.get(
  "/edit-requests",
  asyncHandler(async (req, res) => {
    const status = z.enum(["pending", "approved", "rejected"]).default("pending").parse(req.query.status);
    const requests = await EditRequest.find({ status })
      .populate("book", "title slug updatedAt")
      .populate("requestedBy", "username name")
      .sort(status === "pending" ? { createdAt: 1 } : { reviewedAt: -1 })
      .limit(200);
    res.json({ requests: requests.map(toRequest) });
  })
);

router.post(
  "/edit-requests/:id/approve",
  asyncHandler(async (req, res) => {
    const request = await byId(EditRequest, req.params.id, "Suggestion");
    if (request.status !== "pending") throw badRequest("This suggestion was already reviewed.");
    const book = await Book.findById(request.book);
    if (!book) throw notFound("The summary for this suggestion no longer exists.");

    // Admin can adjust the proposed values before applying.
    const changes = bookUpdateSchema.parse(req.body?.changes ?? request.changes);
    applyFields(book, changes);
    if (changes.title !== undefined) book.slug = await Book.uniqueSlug(changes.title, book._id);
    await book.save();

    const { note } = reviewSchema.parse(req.body ?? {});
    Object.assign(request, { status: "approved", reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: note });
    await request.save();
    res.json({ ok: true, book: await toDetail(book, req.user) });
  })
);

router.post(
  "/edit-requests/:id/reject",
  asyncHandler(async (req, res) => {
    const request = await byId(EditRequest, req.params.id, "Suggestion");
    if (request.status !== "pending") throw badRequest("This suggestion was already reviewed.");
    const { note } = reviewSchema.parse(req.body ?? {});
    Object.assign(request, { status: "rejected", reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: note });
    await request.save();
    res.json({ ok: true });
  })
);

// ---------- Users ----------

router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = z.string().trim().max(100).optional().parse(req.query.q);
    const filter = q
      ? { $or: ["name", "username", "email"].map((f) => ({ [f]: new RegExp(escapeRegex(q), "i") })) }
      : {};
    const list = await User.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({
      users: list.map((u) => ({ ...u.toPublic(), email: u.email, isBanned: u.isBanned })),
    });
  })
);

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const data = z
      .object({ role: z.enum(["user", "admin"]).optional(), isBanned: z.boolean().optional() })
      .strict()
      .parse(req.body);
    const user = await byId(User, req.params.id, "User");
    if (String(user._id) === String(req.user._id)) throw badRequest("You can't change your own role or ban yourself.");
    Object.assign(user, data);
    await user.save();
    res.json({ user: { ...user.toPublic(), email: user.email, isBanned: user.isBanned } });
  })
);

export default router;
