import mongoose from "mongoose";
import { ZodError } from "zod";
import config from "../config.js";
import { HttpError } from "../utils/http.js";

export function notFoundHandler(req, res) {
  res.status(404).json({ error: "Route not found." });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof ZodError) {
    const details = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      details[key] ??= issue.message;
    }
    return res.status(400).json({ error: "Please fix the highlighted fields.", details });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: "Invalid id." });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(err.errors).map(([k, v]) => [k, v.message]));
    return res.status(400).json({ error: "Please fix the highlighted fields.", details });
  }
  if (err?.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "value";
    return res.status(409).json({ error: `That ${field} is already taken.`, details: { [field]: "Already taken" } });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "That request is too large." });
  }
  if (!config.isTest) console.error(err);
  res.status(500).json({ error: "Something went wrong on our side. Please try again." });
}
