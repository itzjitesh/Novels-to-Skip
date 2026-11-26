/**
 * Converts v1 (EJS app) documents to the v2 shape. Safe to run on every start:
 * documents that are already migrated are skipped, so after the first run it does nothing.
 *
 * v1 books:  { title, description, bulletPoint, mainTheme }
 * v1 users:  { name, email, password, confirmPassword, isAdmin }
 */
import { slugify, readingTimeMinutes } from "./utils/text.js";

export async function migrateLegacy(db, log = console.log) {
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

  if (usersMigrated || booksMigrated) log(`Migrated ${usersMigrated} old user(s) and ${booksMigrated} old book(s) to v2.`);
  return { usersMigrated, booksMigrated };
}
