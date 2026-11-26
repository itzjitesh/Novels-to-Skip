import mongoose from "mongoose";

const { ObjectId } = mongoose.Schema.Types;

const commentSchema = new mongoose.Schema(
  {
    book: { type: ObjectId, ref: "Book", required: true, index: true },
    user: { type: ObjectId, ref: "User", required: true },
    parent: { type: ObjectId, ref: "Comment", default: null },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Comment = mongoose.model("Comment", commentSchema);

const ratingSchema = new mongoose.Schema(
  {
    book: { type: ObjectId, ref: "Book", required: true },
    user: { type: ObjectId, ref: "User", required: true },
    value: { type: Number, min: 1, max: 5, required: true },
  },
  { timestamps: true }
);
ratingSchema.index({ book: 1, user: 1 }, { unique: true });

export const Rating = mongoose.model("Rating", ratingSchema);

const editRequestSchema = new mongoose.Schema(
  {
    book: { type: ObjectId, ref: "Book", required: true, index: true },
    requestedBy: { type: ObjectId, ref: "User", required: true, index: true },
    // Only the fields the user wants to change.
    changes: { type: mongoose.Schema.Types.Mixed, required: true },
    // Values of those same fields when the request was made, for the diff view.
    original: { type: mongoose.Schema.Types.Mixed, required: true },
    bookUpdatedAt: { type: Date },
    message: { type: String, maxlength: 1000, default: "" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    reviewedBy: { type: ObjectId, ref: "User" },
    reviewNote: { type: String, maxlength: 1000, default: "" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

export const EditRequest = mongoose.model("EditRequest", editRequestSchema);
