import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import config from "./config.js";
import { loadUser } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import authRoutes from "./routes/auth.js";
import bookRoutes from "./routes/books.js";
import adminRoutes from "./routes/admin.js";
import aiRoutes from "./routes/ai.js";
import seoRoutes, { spaHandler } from "./routes/seo.js";
import { comments, me, users } from "./routes/misc.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "default-src": ["'self'"],
          "img-src": ["'self'", "data:", "https:"],
          "font-src": ["'self'", "https://fonts.gstatic.com"],
          "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'"],
        },
      },
    })
  );
  if (!config.isProd) app.use(cors({ origin: config.clientUrl, credentials: true }));
  app.use(compression());
  if (!config.isTest) app.use(morgan(config.isProd ? "combined" : "dev"));
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  app.use(loadUser);

  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/books", bookRoutes);
  app.use("/api/comments", comments);
  app.use("/api/me", me);
  app.use("/api/users", users);
  app.use("/api/admin", adminRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api", notFoundHandler);
  app.use(seoRoutes);

  // In production the API also serves the built React app.
  const indexHtml = path.join(clientDist, "index.html");
  if (fs.existsSync(indexHtml)) {
    // Hashed build files never change, so they can be cached for a year.
    app.use("/assets", express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y" }));
    app.use(express.static(clientDist, { index: false, maxAge: "1h" }));
    app.get("*", spaHandler(indexHtml));
  }

  app.use(errorHandler);
  return app;
}
