import mongoose from "mongoose";
import config from "./config.js";
import { createApp } from "./app.js";
import { migrateLegacy } from "./migrate.js";
import User from "./models/User.js";

mongoose.set("strictQuery", true);
// Indexes are built after the legacy migration, so old documents without slugs can't block them.
mongoose.set("autoIndex", false);

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");
  await migrateLegacy(mongoose.connection.db);
  await Promise.all(
    Object.values(mongoose.models).map((m) =>
      m.createIndexes().catch((err) => console.error(`Index build failed for ${m.modelName}:`, err.message))
    )
  );
  // Existing accounts listed in ADMIN_EMAILS become admins too, not just new sign-ups.
  if (config.adminEmails.length) {
    const { modifiedCount } = await User.updateMany({ email: { $in: config.adminEmails }, role: { $ne: "admin" } }, { role: "admin" });
    if (modifiedCount) console.log(`Promoted ${modifiedCount} account(s) from ADMIN_EMAILS to admin.`);
  }
  const app = createApp();
  const server = app.listen(config.port, () => console.log(`API listening on http://localhost:${config.port}`));

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((err) => {
  console.error("Failed to start:", err.message);
  process.exit(1);
});
