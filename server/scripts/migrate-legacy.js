/**
 * Runs the v1 -> v2 migration by hand. The server also runs it automatically on start.
 * Usage: npm run migrate:legacy   (reads MONGO_URI from .env)
 */
import mongoose from "mongoose";
import { migrateLegacy } from "../src/migrate.js";

if (!process.env.MONGO_URI) {
  console.error("Set MONGO_URI first.");
  process.exit(1);
}
await mongoose.connect(process.env.MONGO_URI);
const result = await migrateLegacy(mongoose.connection.db);
console.log(`Done: ${result.usersMigrated} user(s), ${result.booksMigrated} book(s) migrated.`);
await mongoose.disconnect();
