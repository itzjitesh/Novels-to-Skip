/**
 * Full moderation flow against a real MongoDB.
 * Runs only when TEST_MONGO_URI is set, e.g.
 *   TEST_MONGO_URI=mongodb://127.0.0.1:27017/nts-test npm test
 * The database is wiped before and after.
 */
process.env.NODE_ENV = "test";
process.env.ADMIN_EMAILS = "admin@test.dev";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";

const uri = process.env.TEST_MONGO_URI;
const skip = !uri && "set TEST_MONGO_URI to run the database flow tests";

let app;
const admin = () => request.agent(app);
before(async () => {
  if (!uri) return;
  await mongoose.connect(uri);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  app = (await import("../src/app.js")).createApp();
});
after(async () => {
  if (!uri) return;
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

const book = {
  title: "The Test Novel",
  author: "A. Writer",
  genres: ["Classic", "classic", "Drama"],
  pageCount: 300,
  theme: "A book that exists only to be tested thoroughly.",
  keyPoints: ["One", "Two"],
  summary: "A long enough summary. ".repeat(10),
  verdict: "skim",
};

test("submission → approval → edit request → approval", { skip }, async () => {
  const a = admin();
  const u = request.agent(app);
  const other = request.agent(app);

  const reg = await a.post("/api/auth/register").send({ name: "Admin", username: "admin1", email: "admin@test.dev", password: "password123" }).expect(201);
  assert.equal(reg.body.user.role, "admin");
  await u.post("/api/auth/register").send({ name: "Reader", username: "reader1", email: "reader@test.dev", password: "password123" }).expect(201);
  await other.post("/api/auth/register").send({ name: "Other", username: "other1", email: "other@test.dev", password: "password123" }).expect(201);
  await request(app).post("/api/auth/register").send({ name: "Dup", username: "dup1", email: "READER@test.dev", password: "password123" }).expect(409);

  // User submission goes to the queue and is hidden from the public.
  const created = await u.post("/api/books").send(book).expect(201);
  const { id, slug } = created.body.book;
  assert.equal(created.body.book.status, "pending");
  assert.deepEqual(created.body.book.genres, ["classic", "drama"]);
  assert.equal(slug, "the-test-novel");
  await request(app).get(`/api/books/slug/${slug}`).expect(404);
  await other.get(`/api/books/slug/${slug}`).expect(404);
  await u.get(`/api/books/slug/${slug}`).expect(200);
  assert.equal((await request(app).get("/api/books")).body.total, 0);

  // Other users can't touch it; the owner can edit while pending.
  await other.patch(`/api/books/${id}`).send({ title: "Hacked" }).expect(403);
  await u.patch(`/api/books/${id}`).send({ verdict: "skip" }).expect(200);

  // Reject, owner fixes, it goes back to pending.
  await a.post(`/api/admin/books/${id}/reject`).send({}).expect(400);
  await a.post(`/api/admin/books/${id}/reject`).send({ note: "Add more detail" }).expect(200);
  const fixed = await u.patch(`/api/books/${id}`).send({ summary: book.summary + " More detail." }).expect(200);
  assert.equal(fixed.body.book.status, "pending");

  await a.post(`/api/admin/books/${id}/approve`).send({}).expect(200);
  const list = await request(app).get("/api/books?genre=classic&q=test").expect(200);
  assert.equal(list.body.total, 1);

  // Once live, the owner can no longer edit directly.
  await u.patch(`/api/books/${id}`).send({ title: "Nope" }).expect(403);
  await u.delete(`/api/books/${id}`).expect(403);

  // Edit request flow.
  await other.post(`/api/books/${id}/edit-requests`).send({ changes: { author: "A. Writer" } }).expect(400); // no-op
  const er = await other
    .post(`/api/books/${id}/edit-requests`)
    .send({ changes: { title: "The Tested Novel", author: "A. Writer" }, message: "Typo in title" })
    .expect(201);
  assert.deepEqual(Object.keys(er.body.request.changes), ["title"]);
  assert.equal(er.body.request.original.title, "The Test Novel");

  await other.get("/api/admin/edit-requests").expect(403);
  const pending = await a.get("/api/admin/edit-requests").expect(200);
  assert.equal(pending.body.requests.length, 1);
  await a.post(`/api/admin/edit-requests/${er.body.request._id}/approve`).send({ note: "Thanks" }).expect(200);
  await a.post(`/api/admin/edit-requests/${er.body.request._id}/approve`).send({}).expect(400);

  const renamed = await request(app).get("/api/books/slug/the-tested-novel").expect(200);
  assert.equal(renamed.body.book.title, "The Tested Novel");
  const mine = await other.get("/api/me/submissions").expect(200);
  assert.equal(mine.body.editRequests[0].status, "approved");
});

test("likes, ratings, bookmarks, shelves and comments", { skip }, async () => {
  const u = request.agent(app);
  await u.post("/api/auth/login").send({ email: "reader@test.dev", password: "password123" }).expect(200);
  const { body } = await request(app).get("/api/books").expect(200);
  const id = body.items[0].id;

  assert.equal((await u.post(`/api/books/${id}/like`)).body.likesCount, 1);
  assert.equal((await u.post(`/api/books/${id}/like`)).body.likesCount, 0);
  await u.post(`/api/books/${id}/like`).expect(200);

  await u.put(`/api/books/${id}/rating`).send({ value: 6 }).expect(400);
  assert.equal((await u.put(`/api/books/${id}/rating`).send({ value: 4 })).body.ratingAvg, 4);

  await u.post(`/api/books/${id}/bookmark`).expect(200, { bookmarked: true });
  await u.put(`/api/books/${id}/shelf`).send({ shelf: "skipped" }).expect(200);
  const lib = await u.get("/api/me/library").expect(200);
  assert.equal(lib.body.bookmarks.length, 1);
  assert.equal(lib.body.shelves[0].shelf, "skipped");

  const c = await u.post(`/api/books/${id}/comments`).send({ body: "Great summary" }).expect(201);
  const r = await u.post(`/api/books/${id}/comments`).send({ body: "Reply", parent: c.body.comment.id }).expect(201);
  // Reply to a reply is attached to the top-level comment.
  const rr = await u.post(`/api/books/${id}/comments`).send({ body: "Nested", parent: r.body.comment.id }).expect(201);
  assert.equal(String(rr.body.comment.parent), String(c.body.comment.id));
  await request(app).delete(`/api/comments/${c.body.comment.id}`).expect(401);
  await u.delete(`/api/comments/${c.body.comment.id}`).expect(200);

  const detail = await u.get(`/api/books/slug/the-tested-novel`).expect(200);
  assert.equal(detail.body.book.viewer.liked, true);
  assert.equal(detail.body.book.viewer.rating, 4);
  assert.equal(detail.body.book.commentsCount, 2);

  const profile = await request(app).get("/api/users/reader1").expect(200);
  assert.equal(profile.body.stats.summaries, 1);
  const sitemap = await request(app).get("/sitemap.xml").expect(200);
  assert.match(sitemap.text, /the-tested-novel/);
});
