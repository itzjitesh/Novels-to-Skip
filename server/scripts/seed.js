/** Adds sample summaries for local development. Usage: npm run seed */
import mongoose from "mongoose";
import Book from "../src/models/Book.js";
import User from "../src/models/User.js";
import seed from "./seed-data.js";

if (!process.env.MONGO_URI) {
  console.error("Set MONGO_URI first.");
  process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI);

let admin = await User.findOne({ role: "admin" });
if (!admin) {
  admin = await User.create({
    name: "Site Admin",
    username: "admin",
    email: "admin@example.com",
    password: "change-me-now",
    role: "admin",
  });
  console.log("Created admin@example.com / change-me-now — change this password after logging in.");
}

let added = 0;
for (const [i, data] of seed.entries()) {
  if (await Book.exists({ title: data.title })) continue;
  await Book.create({
    ...data,
    slug: await Book.uniqueSlug(data.title),
    status: "published",
    featured: i < 3,
    createdBy: admin._id,
    publishedAt: new Date(Date.now() - i * 86400000),
  });
  added += 1;
}
console.log(`Added ${added} sample summaries.`);
await mongoose.disconnect();
