import { Router } from "express";
import mongoose from "mongoose";
import Book from "../models/Book.js";
import User from "../models/User.js";
import { Comment, EditRequest } from "../models/social.js";
import { isAdmin, requireAuth } from "../middleware/auth.js";
import { CARD_FIELDS, toCard } from "../services/books.js";
import { asyncHandler, badRequest, forbidden, notFound } from "../utils/http.js";
import { passwordSchema, profileSchema } from "../validation.js";

// ---------- /api/comments ----------
export const comments = Router();

comments.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound("Comment not found.");
    const comment = await Comment.findById(req.params.id);
    if (!comment || comment.deleted) throw notFound("Comment not found.");
    if (!isAdmin(req.user) && String(comment.user) !== String(req.user._id)) throw forbidden();
    // Soft delete keeps replies attached to their thread.
    comment.deleted = true;
    comment.body = "";
    await comment.save();
    await Book.updateOne({ _id: comment.book, commentsCount: { $gt: 0 } }, { $inc: { commentsCount: -1 } });
    res.json({ ok: true });
  })
);

// ---------- /api/me ----------
export const me = Router();
me.use(requireAuth);

me.get(
  "/library",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
      .populate({ path: "bookmarks", select: CARD_FIELDS, match: { status: "published" } })
      .populate({ path: "library.book", select: CARD_FIELDS, match: { status: "published" } });
    res.json({
      bookmarks: user.bookmarks.filter(Boolean).map(toCard),
      shelves: user.library
        .filter((i) => i.book)
        .sort((a, b) => b.addedAt - a.addedAt)
        .map((i) => ({ shelf: i.shelf, addedAt: i.addedAt, book: toCard(i.book) })),
    });
  })
);

me.get(
  "/submissions",
  asyncHandler(async (req, res) => {
    const [books, requests] = await Promise.all([
      Book.find({ createdBy: req.user._id }).select(`${CARD_FIELDS} rejectionReason`).sort({ updatedAt: -1 }),
      EditRequest.find({ requestedBy: req.user._id }).populate("book", "title slug").sort({ createdAt: -1 }).limit(100),
    ]);
    res.json({
      books: books.map((b) => ({ ...toCard(b), rejectionReason: b.rejectionReason })),
      editRequests: requests.map((r) => ({
        id: r._id,
        book: r.book ? { title: r.book.title, slug: r.book.slug } : null,
        fields: Object.keys(r.changes || {}),
        message: r.message,
        status: r.status,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
        reviewedAt: r.reviewedAt,
      })),
    });
  })
);

me.patch(
  "/",
  asyncHandler(async (req, res) => {
    const data = profileSchema.parse(req.body);
    Object.assign(req.user, data);
    await req.user.save();
    res.json({ user: req.user.toPrivate() });
  })
);

me.patch(
  "/password",
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = passwordSchema.parse(req.body);
    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.checkPassword(currentPassword))) {
      throw badRequest("Your current password is incorrect.", { currentPassword: "Incorrect password" });
    }
    user.password = newPassword;
    await user.save();
    res.json({ ok: true });
  })
);

// ---------- /api/users ----------
export const users = Router();

users.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ username: String(req.params.username).toLowerCase(), isBanned: false });
    if (!user) throw notFound("User not found.");
    const books = await Book.find({ createdBy: user._id, status: "published" })
      .select(CARD_FIELDS)
      .sort({ publishedAt: -1 })
      .limit(60);
    const totals = books.reduce(
      (acc, b) => ({ likes: acc.likes + (b.likesCount || 0), hours: acc.hours + (b.hoursSaved || 0) }),
      { likes: 0, hours: 0 }
    );
    res.json({
      user: user.toPublic(),
      books: books.map((b) => toCard({ ...b.toObject(), createdBy: user })),
      stats: { summaries: books.length, likes: totals.likes, hoursSaved: Math.round(totals.hours) },
    });
  })
);
