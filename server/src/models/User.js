import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const SHELVES = ["want", "reading", "finished", "skipped"];

const libraryItemSchema = new mongoose.Schema(
  {
    book: { type: mongoose.Schema.Types.ObjectId, ref: "Book", required: true },
    shelf: { type: String, enum: SHELVES, required: true },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]{3,24}$/,
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    bio: { type: String, maxlength: 280, default: "" },
    avatarUrl: { type: String, default: "" },
    bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }],
    library: [libraryItemSchema],
    isBanned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    bio: this.bio,
    avatarUrl: this.avatarUrl,
    role: this.role,
    createdAt: this.createdAt,
  };
};

userSchema.methods.toPrivate = function toPrivate() {
  return {
    ...this.toPublic(),
    email: this.email,
    bookmarks: this.bookmarks,
    library: this.library,
  };
};

export default mongoose.model("User", userSchema);
