import { test } from "node:test";
import assert from "node:assert/strict";
import { ObjectId } from "mongodb";
import { migrateLegacy } from "../src/migrate.js";

/** Tiny in-memory stand-in for the parts of a Mongo collection the migration uses. */
function fakeCollection(docs, indexes = []) {
  const matches = (d, q) =>
    Object.entries(q).every(([k, v]) => (v && typeof v === "object" && "$exists" in v ? (k in d) === v.$exists : d[k] === v));
  return {
    docs,
    indexExists: async (n) => indexes.includes(n),
    dropIndex: async (n) => indexes.splice(indexes.indexOf(n), 1),
    distinct: async (f) => [...new Set(docs.map((d) => d[f]).filter((x) => x !== undefined))],
    findOne: async (q) => docs.find((d) => matches(d, q)) ?? null,
    find: (q) => ({
      async *[Symbol.asyncIterator]() {
        for (const d of docs.filter((x) => matches(x, q))) yield d;
      },
    }),
    updateOne: async ({ _id }, { $set = {}, $unset = {} }) => {
      const d = docs.find((x) => x._id.equals(_id));
      Object.assign(d, $set);
      for (const k of Object.keys($unset)) delete d[k];
    },
  };
}

test("migrates v1 users and books, and is a no-op the second time", async () => {
  const users = fakeCollection([
    { _id: new ObjectId(), name: "Jitesh", email: "Jitesh@Example.com", password: "$2b$10$hash", confirmPassword: "$2b$10$hash", isAdmin: true },
    { _id: new ObjectId(), name: "Jo", email: "jitesh@other.com", password: "x", isAdmin: false },
  ]);
  const titleIndex = ["_id_", "title_1"];
  const books = fakeCollection(
    [
      { _id: new ObjectId(), title: "The Alchemist?", description: "Para one.\n\nPara two.", bulletPoint: "Point A\nPoint B\n\nPoint C", mainTheme: "Follow your dream." },
      { _id: new ObjectId(), title: "The Alchemist!", description: "Another", bulletPoint: "", mainTheme: "" },
    ],
    titleIndex
  );
  const db = { collection: (n) => (n === "users" ? users : books) };

  const r = await migrateLegacy(db, () => {});
  assert.deepEqual(r, { usersMigrated: 2, booksMigrated: 2 });
  assert.ok(!titleIndex.includes("title_1"));

  const [admin, other] = users.docs;
  assert.equal(admin.username, "jitesh");
  assert.equal(other.username, "jitesh2");
  assert.equal(admin.email, "jitesh@example.com");
  assert.equal(admin.role, "admin");
  assert.equal(other.role, "user");
  assert.equal(admin.password, "$2b$10$hash");
  assert.ok(!("confirmPassword" in admin) && !("isAdmin" in admin));

  const [b1, b2] = books.docs;
  assert.equal(b1.slug, "the-alchemist");
  assert.equal(b2.slug, "the-alchemist-2");
  assert.deepEqual(b1.keyPoints, ["Point A", "Point B", "Point C"]);
  assert.equal(b1.theme, "Follow your dream.");
  assert.equal(b1.summary, "Para one.\n\nPara two.");
  assert.equal(b1.status, "published");
  assert.ok(b1.createdBy.equals(admin._id));
  assert.equal(b2.theme, "Another"); // falls back to the description when mainTheme is empty
  assert.ok(!("description" in b1) && !("bulletPoint" in b1) && !("mainTheme" in b1));

  assert.deepEqual(await migrateLegacy(db, () => {}), { usersMigrated: 0, booksMigrated: 0 });
});
