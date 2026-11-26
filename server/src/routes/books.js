import { Router } from "express";
import mongoose from "mongoose";
import config from "../config.js";
import Book from "../models/Book.js";
import User from "../models/User.js";
import { Comment, EditRequest, Rating } from "../models/social.js";
import { isAdmin, requireAuth } from "../middleware/auth.js";
import { applyFields, CARD_FIELDS, diffChanges, snapshot, toCard, toDetail } from "../services/books.js";
import { asyncHandler, badRequest, escapeRegex, forbidden, notFound } from "../utils/http.js";
import {
  bookCreateSchema,
  bookUpdateSchema,
  commentSchema,
  editRequestSchema,
  listQuerySchema,
  ratingSchema,
  shelfSchema,
} from "../validation.js";

const router = Router();
const WRITER = { path: "createdBy", select: "username name avatarUrl" };

const SORTS = {
  newest: { publishedAt: -1, _id: -1 },
  oldest: { publishedAt: 1, _id: 1 },
  popular: { likesCount: -1, views: -1, _id: -1 },
  top: { ratingAvg: -1, ratingCount: -1, _id: -1 },
  title: { title: 1, _id: 1 },
};

async function findBookById(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound("Summary not found.");
  const book = await Book.findById(id);
  if (!book) throw notFound("Summary not found.");
  return book;
}

const isOwner = (book, user) => user && String(book.createdBy) === String(user._id);

/** Only published summaries are public. Owners and admins can also see pending/rejected ones. */
function assertVisible(book, user) {
  if (book.status === "published") return;
  if (isAdmin(user) || isOwner(book, user)) return;
  throw notFound("Summary not found.");
}

// ---------- Listing ----------

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const filter = { status: "published" };
    if (q.genre) filter.genres = q.genre.toLowerCase();
    if (q.verdict) filter.verdict = q.verdict;
    if (q.author) filter.author = new RegExp(`^${escapeRegex(q.author)}$`, "i");
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), "i");
      filter.$or = [{ title: rx }, { author: rx }, { genres: rx }, { theme: rx }];
    }
    const [items, total] = await Promise.all([
      Book.find(filter)
        .select(CARD_FIELDS)
        .populate(WRITER)
        .sort(SORTS[q.sort])
        .skip((q.page - 1) * q.limit)
        .limit(q.limit),
      Book.countDocuments(filter),
    ]);
    res.json({
      items: items.map(toCard),
      page: q.page,
      limit: q.limit,
      total,
      pages: Math.max(1, Math.ceil(total / q.limit)),
    });
  })
);

router.get(
  "/home",
  asyncHandler(async (req, res) => {
    const published = { status: "published" };
    const find = (filter, sort, limit) => Book.find(filter).select(CARD_FIELDS).populate(WRITER).sort(sort).limit(limit);
    const [featured, latest, popular, topRated, stats] = await Promise.all([
      find({ ...published, featured: true }, { publishedAt: -1 }, 3),
      find(published, SORTS.newest, 6),
      find(published, SORTS.popular, 6),
      find({ ...published, ratingCount: { $gte: 1 } }, SORTS.top, 6),
      Book.aggregate([
        { $match: published },
        { $group: { _id: null, books: { $sum: 1 }, hours: { $sum: { $ifNull: ["$hoursSaved", 0] } } } },
      ]),
    ]);
    // Fall back to the latest books if nothing is featured yet.
    const hero = featured.length ? featured : latest.slice(0, 3);
    res.json({
      featured: hero.map(toCard),
      latest: latest.map(toCard),
      popular: popular.map(toCard),
      topRated: topRated.map(toCard),
      stats: { books: stats[0]?.books ?? 0, hoursSaved: Math.round(stats[0]?.hours ?? 0) },
    });
  })
);

router.get(
  "/genres",
  asyncHandler(async (req, res) => {
    const genres = await Book.aggregate([
      { $match: { status: "published" } },
      { $unwind: "$genres" },
      { $group: { _id: "$genres", count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 40 },
    ]);
    res.json({ genres: genres.map((g) => ({ name: g._id, count: g.count })) });
  })
);

router.get(
  "/slug/:slug",
  asyncHandler(async (req, res) => {
    const book = await Book.findOne({ slug: String(req.params.slug).toLowerCase() }).populate(WRITER);
    if (!book) throw notFound("Summary not found.");
    assertVisible(book, req.user);

    if (book.status === "published" && !isOwner(book, req.user)) {
      // Fire and forget; a lost view count is not worth failing the request.
      Book.updateOne({ _id: book._id }, { $inc: { views: 1 } }).catch(() => {});
    }

    const related = await Book.find({
      status: "published",
      _id: { $ne: book._id },
      $or: [{ genres: { $in: book.genres } }, ...(book.author ? [{ author: book.author }] : [])],
    })
      .select(CARD_FIELDS)
      .sort({ ratingAvg: -1, likesCount: -1 })
      .limit(4);

    res.json({ book: await toDetail(book, req.user), related: related.map(toCard) });
  })
);

// ---------- Create / edit / delete ----------

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = bookCreateSchema.parse(req.body);
    const book = new Book({ createdBy: req.user._id });
    applyFields(book, data);
    book.slug = await Book.uniqueSlug(data.title);
    book.status = isAdmin(req.user) || config.autoPublishUserPosts ? "published" : "pending";
    await book.save();
    res.status(201).json({ book: await toDetail(book, req.user) });
  })
);

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    const admin = isAdmin(req.user);
    if (!admin) {
      if (!isOwner(book, req.user)) throw forbidden("Only admins can edit this summary directly. Suggest an edit instead.");
      if (book.status === "published") throw forbidden("This summary is live. Suggest an edit and an admin will review it.");
    }
    const data = bookUpdateSchema.parse(req.body);
    applyFields(book, data);
    if (data.title !== undefined) book.slug = await Book.uniqueSlug(data.title, book._id);
    // A rejected summary edited by its writer goes back into the review queue.
    if (!admin && book.status === "rejected") {
      book.status = "pending";
      book.rejectionReason = "";
    }
    await book.save();
    await book.populate(WRITER);
    res.json({ book: await toDetail(book, req.user) });
  })
);

router.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    if (!isAdmin(req.user) && !(isOwner(book, req.user) && book.status !== "published")) {
      throw forbidden("Only admins can delete published summaries.");
    }
    await Promise.all([
      book.deleteOne(),
      Comment.deleteMany({ book: book._id }),
      Rating.deleteMany({ book: book._id }),
      EditRequest.deleteMany({ book: book._id }),
      User.updateMany(
        { $or: [{ bookmarks: book._id }, { "library.book": book._id }] },
        { $pull: { bookmarks: book._id, library: { book: book._id } } }
      ),
    ]);
    res.json({ ok: true });
  })
);

// ---------- Edit requests ----------

router.post(
  "/:id/edit-requests",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    if (book.status !== "published") throw badRequest("You can only suggest edits to live summaries.");
    const { changes, message } = editRequestSchema.parse(req.body);
    const real = diffChanges(book, changes);
    if (!Object.keys(real).length) throw badRequest("Nothing changed. Edit at least one field before submitting.");

    const existing = await EditRequest.countDocuments({ book: book._id, requestedBy: req.user._id, status: "pending" });
    if (existing >= 3) throw badRequest("You already have 3 pending suggestions for this summary. Please wait for a review.");

    const request = await EditRequest.create({
      book: book._id,
      requestedBy: req.user._id,
      changes: real,
      original: snapshot(book, Object.keys(real)),
      bookUpdatedAt: book.updatedAt,
      message,
    });
    res.status(201).json({ request });
  })
);

// ---------- Reactions ----------

router.post(
  "/:id/like",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    if (book.status !== "published") throw badRequest("You can only like live summaries.");
    const uid = req.user._id;
    // Two conditional updates keep likesCount in sync with the likes array, even under double-clicks.
    let updated = await Book.findOneAndUpdate(
      { _id: book._id, likes: { $ne: uid } },
      { $addToSet: { likes: uid }, $inc: { likesCount: 1 } },
      { new: true }
    );
    let liked = true;
    if (!updated) {
      updated = await Book.findOneAndUpdate(
        { _id: book._id, likes: uid },
        { $pull: { likes: uid }, $inc: { likesCount: -1 } },
        { new: true }
      );
      liked = false;
    }
    res.json({ liked, likesCount: updated?.likesCount ?? book.likesCount });
  })
);

router.post(
  "/:id/bookmark",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    const has = req.user.bookmarks.some((b) => String(b) === String(book._id));
    await User.updateOne({ _id: req.user._id }, has ? { $pull: { bookmarks: book._id } } : { $addToSet: { bookmarks: book._id } });
    res.json({ bookmarked: !has });
  })
);

router.put(
  "/:id/shelf",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    const { shelf } = shelfSchema.parse(req.body);
    await User.updateOne({ _id: req.user._id }, { $pull: { library: { book: book._id } } });
    if (shelf) {
      await User.updateOne({ _id: req.user._id }, { $push: { library: { book: book._id, shelf, addedAt: new Date() } } });
    }
    res.json({ shelf });
  })
);

async function refreshRating(bookId) {
  const [agg] = await Rating.aggregate([
    { $match: { book: bookId } },
    { $group: { _id: null, avg: { $avg: "$value" }, count: { $sum: 1 } } },
  ]);
  const ratingAvg = agg ? Math.round(agg.avg * 100) / 100 : 0;
  const ratingCount = agg?.count ?? 0;
  await Book.updateOne({ _id: bookId }, { ratingAvg, ratingCount });
  return { ratingAvg: Math.round(ratingAvg * 10) / 10, ratingCount };
}

router.put(
  "/:id/rating",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    if (book.status !== "published") throw badRequest("You can only rate live summaries.");
    const { value } = ratingSchema.parse(req.body);
    await Rating.findOneAndUpdate({ book: book._id, user: req.user._id }, { value }, { upsert: true });
    res.json({ rating: value, ...(await refreshRating(book._id)) });
  })
);

router.delete(
  "/:id/rating",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    await Rating.deleteOne({ book: book._id, user: req.user._id });
    res.json({ rating: null, ...(await refreshRating(book._id)) });
  })
);

// ---------- Comments ----------

const toComment = (c, viewer) => ({
  id: c._id,
  parent: c.parent,
  body: c.deleted ? "" : c.body,
  deleted: c.deleted,
  createdAt: c.createdAt,
  user: c.deleted ? null : c.user && { username: c.user.username, name: c.user.name, avatarUrl: c.user.avatarUrl },
  canDelete: Boolean(viewer && !c.deleted && (isAdmin(viewer) || String(c.user?._id) === String(viewer._id))),
});

router.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    assertVisible(book, req.user);
    const comments = await Comment.find({ book: book._id })
      .populate("user", "username name avatarUrl")
      .sort({ createdAt: 1 })
      .limit(500);
    res.json({ comments: comments.map((c) => toComment(c, req.user)) });
  })
);

router.post(
  "/:id/comments",
  requireAuth,
  asyncHandler(async (req, res) => {
    const book = await findBookById(req.params.id);
    if (book.status !== "published") throw badRequest("Comments open once the summary is live.");
    const { body, parent } = commentSchema.parse(req.body);
    let parentId = parent || null;
    if (parent) {
      const p = await Comment.findOne({ _id: parent, book: book._id });
      if (!p) throw badRequest("The comment you're replying to no longer exists.");
      // Keep threads one level deep: replying to a reply attaches to the top-level comment.
      if (p.parent) parentId = p.parent;
    }
    const comment = await Comment.create({ book: book._id, user: req.user._id, body, parent: parentId });
    await Book.updateOne({ _id: book._id }, { $inc: { commentsCount: 1 } });
    await comment.populate("user", "username name avatarUrl");
    res.status(201).json({ comment: toComment(comment, req.user) });
  })
);

export default router;
