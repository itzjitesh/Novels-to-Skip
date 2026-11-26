import mongoose from "mongoose";
import config from "./config.js";
import { createApp } from "./app.js";

mongoose.set("strictQuery", true);

async function start() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");
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
