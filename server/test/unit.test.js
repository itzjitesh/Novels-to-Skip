process.env.NODE_ENV = "test";
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import mongoose from "mongoose";
import { slugify, readingTimeMinutes, hoursSaved, excerpt } from "../src/utils/text.js";
import { escapeRegex } from "../src/utils/http.js";
import { bookCreateSchema, bookUpdateSchema, registerSchema, editRequestSchema } from "../src/validation.js";
import { diffChanges, snapshot } from "../src/services/books.js";
import { createApp } from "../src/app.js";

// Don't let model calls hang waiting for a connection in these DB-free tests.
mongoose.set("bufferCommands", false);

test("slugify makes URL-safe slugs and never returns empty", () => {
  assert.equal(slugify("Crime & Punishment?"), "crime-and-punishment");
  assert.equal(slugify("1984 / Orwell #1"), "1984-orwell-1");
  assert.equal(slugify("???"), "book");
});

test("reading time and hours saved", () => {
  assert.equal(readingTimeMinutes("word ".repeat(460)), 2);
  assert.equal(readingTimeMinutes(""), 1);
  assert.equal(hoursSaved(300, 5), 8.4);
  assert.equal(hoursSaved(null), null);
});

test("excerpt cuts on a word boundary", () => {
  assert.equal(excerpt("short"), "short");
  const out = excerpt("one two three four five", 12);
  assert.ok(out.endsWith("…"));
  assert.ok(!out.includes("fou"));
});

test("escapeRegex neutralises regex syntax", () => {
  assert.ok(new RegExp(escapeRegex("a.*b(")).test("a.*b("));
});

const validBook = {
  title: "Moby-Dick",
  theme: "A captain hunts a whale.",
  summary: "x".repeat(60),
};

test("book create schema applies defaults and rejects bad input", () => {
  const parsed = bookCreateSchema.parse(validBook);
  assert.equal(parsed.verdict, "skip");
  assert.deepEqual(parsed.genres, []);
  assert.throws(() => bookCreateSchema.parse({ ...validBook, summary: "short" }));
  assert.throws(() => bookCreateSchema.parse({ ...validBook, coverUrl: "javascript:alert(1)" }));
});

test("book update schema does not invent defaults and rejects unknown fields", () => {
  const parsed = bookUpdateSchema.parse({ title: "New" });
  assert.deepEqual(parsed, { title: "New" });
  assert.throws(() => bookUpdateSchema.parse({}));
  assert.throws(() => bookUpdateSchema.parse({ status: "published" }));
  assert.throws(() => editRequestSchema.parse({ changes: { likesCount: 999 } }));
});

test("register schema normalises email and username", () => {
  const p = registerSchema.parse({ name: "Jitesh", username: "Jitesh_S", email: " J@X.com ", password: "12345678" });
  assert.equal(p.email, "j@x.com");
  assert.equal(p.username, "jitesh_s");
  assert.throws(() => registerSchema.parse({ name: "J", username: "a b", email: "x", password: "1" }));
});

test("diffChanges keeps only real changes and snapshot copies originals", () => {
  const book = { title: "A", keyPoints: ["x", "y"], author: "" };
  const diff = diffChanges(book, { title: "A", keyPoints: ["x", "z"], author: "Someone" });
  assert.deepEqual(diff, { keyPoints: ["x", "z"], author: "Someone" });
  assert.deepEqual(snapshot(book, Object.keys(diff)), { keyPoints: ["x", "y"], author: "" });
});

const app = createApp();

test("health, robots and unknown API routes", async () => {
  await request(app).get("/api/health").expect(200, { ok: true });
  const robots = await request(app).get("/robots.txt").expect(200);
  assert.match(robots.text, /Sitemap: .*\/sitemap\.xml/);
  await request(app).get("/api/nope").expect(404);
});

test("protected routes require login", async () => {
  await request(app).post("/api/books").send(validBook).expect(401);
  await request(app).get("/api/me/library").expect(401);
  await request(app).get("/api/admin/stats").expect(401);
  await request(app).post("/api/ai/draft").send({ title: "x" }).expect(401);
});

test("validation errors come back as field details before touching the DB", async () => {
  const res = await request(app).post("/api/auth/register").send({ email: "bad" }).expect(400);
  assert.ok(res.body.details.email);
  assert.ok(res.body.details.password);
});

test("a forged session cookie is ignored", async () => {
  await request(app).get("/api/auth/me").set("Cookie", "nts_token=not-a-jwt").expect(200, { user: null });
});
