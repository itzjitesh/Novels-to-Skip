/**
 * One-time migration from the v1 (EJS) database shape to v2.
 *
 * v1 books:  { title, description, bulletPoint, mainTheme }
 * v1 users:  { name, email, password, confirmPassword, isAdmin }
 *
 * Safe to run more than once: already-migrated documents are skipped.
 * Usage: npm run migrate:legacy   (reads MONGO_URI from .env)
 */
import mongoose from "mongoose";
import { slugify, readingTimeMinutes } from "../src/utils/text.js";

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("Set MONGO_URI first.");
  process.exit(1);
}

await mongoose.connect(uri);
const db = mongoose.connection.db;
const books = db.collection("books");
const users = db.collection("users");

// v1 had a unique index on title; v2 uses slug instead.
for (const name of ["title_1"]) {
  if (await books.indexExists(name).catch(() => false)) {
    await books.dropIndex(name);
    console.log(`Dropped old index books.${name}`);
  }
}

// ---- Users ----
const takenUsernames = new Set((await users.distinct("username")).filter(Boolean));
function makeUsername(email, name) {
  const base = (email?.split("@")[0] || name || "reader").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 18) || "reader";
  let candidate = base.length >= 3 ? base : `${base}_reader`;
  for (let i = 2; takenUsernames.has(candidate); i += 1) candidate = `${base}${i}`;
  takenUsernames.add(candidate);
  return candidate;
}

let usersMigrated = 0;
for await (const u of users.find({ username: { $exists: false } })) {
  await users.updateOne(
    { _id: u._id },
    {
      $set: {
        username: makeUsername(u.email, u.name),
        email: String(u.email || "").toLowerCase(),
        role: u.isAdmin ? "admin" : "user",
        bio: "",
        avatarUrl: "",
        bookmarks: [],
        library: [],
        isBanned: false,
        createdAt: u._id.getTimestamp(),
        updatedAt: new Date(),
      },
      // Old bcrypt hashes stay valid with bcryptjs, so passwords keep working.
      $unset: { confirmPassword: "", isAdmin: "" },
    }
  );
  usersMigrated += 1;
}

// ---- Books ----
const admin = await users.findOne({ role: "admin" });
const takenSlugs = new Set((await books.distinct("slug")).filter(Boolean));
let booksMigrated = 0;
for await (const b of books.find({ slug: { $exists: false } })) {
  let slug = slugify(b.title).slice(0, 80);
  for (let i = 2; takenSlugs.has(slug); i += 1) slug = `${slugify(b.title).slice(0, 80)}-${i}`;
  takenSlugs.add(slug);

  const keyPoints = String(b.bulletPoint || "")
    .split(/\r?\n|•|(?:^|\s)[-*]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
  const theme = String(b.mainTheme || "").trim() || String(b.description || "").slice(0, 300);
  const summary = String(b.description || "").trim() || theme;
  const created = b._id.getTimestamp();

  await books.updateOne(
    { _id: b._id },
    {
      $set: {
        slug,
        author: "",
        genres: [],
        coverUrl: "",
        theme,
        keyPoints,
        summary,
        spoilers: "",
        verdict: "skip",
        verdictReason: "",
        status: "published",
        rejectionReason: "",
        featured: false,
        createdBy: admin?._id ?? null,
        publishedAt: created,
        readingTime: readingTimeMinutes(theme, keyPoints, summary),
        hoursSaved: null,
        likes: [],
        likesCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        commentsCount: 0,
        views: 0,
        createdAt: created,
        updatedAt: new Date(),
      },
      $unset: { description: "", bulletPoint: "", mainTheme: "" },
    }
  );
  booksMigrated += 1;
}

console.log(`Migrated ${usersMigrated} user(s) and ${booksMigrated} book(s).`);
if (booksMigrated) console.log("Tip: open each migrated summary as admin to add author, genres, cover and verdict.");
if (!admin) console.log("No admin found yet. Run: npm run make-admin -- you@example.com");
await mongoose.disconnect();
