import { Router } from "express";
import rateLimit from "express-rate-limit";
import config from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";
import { aiDraftSchema } from "../validation.js";

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.user?._id ?? req.ip),
  message: { error: "You've used your AI drafts for this hour. Try again later." },
});

router.get("/status", (req, res) => res.json({ enabled: Boolean(config.anthropicApiKey) }));

const PROMPT = (title, author) => `You help write "Novels to Skip" summaries: the reader wants the gist of a novel without reading it.

Write a draft for the novel "${title}"${author ? ` by ${author}` : ""}.
If you don't know this book well enough to summarise it accurately, set "unknown" to true and leave the other fields empty. Never invent plot details.

Respond with ONLY a JSON object, no markdown fences:
{
  "unknown": false,
  "author": "author's full name",
  "publishedYear": 1949,
  "pageCount": 328,
  "genres": ["up to 4 lowercase genres"],
  "theme": "1-2 sentences on what the book is really about",
  "keyPoints": ["5-8 short takeaways, one sentence each"],
  "summary": "a spoiler-light plot summary in 4-6 paragraphs separated by blank lines",
  "spoilers": "how it ends and the major twists, 1-2 paragraphs",
  "verdict": "skip | skim | read  (skip = the summary is enough, skim = read a few chapters, read = worth reading in full)",
  "verdictReason": "one sentence explaining the verdict"
}`;

router.post(
  "/draft",
  requireAuth,
  aiLimiter,
  asyncHandler(async (req, res) => {
    if (!config.anthropicApiKey) throw new HttpError(503, "AI drafts aren't set up on this site yet.");
    const { title, author } = aiDraftSchema.parse(req.body);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.anthropicApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.aiModel,
        max_tokens: 4000,
        messages: [{ role: "user", content: PROMPT(title, author) }],
      }),
      signal: AbortSignal.timeout(90_000),
    }).catch(() => null);

    if (!response?.ok) {
      if (response) console.error("AI draft failed", response.status, await response.text().catch(() => ""));
      throw new HttpError(502, "The AI couldn't write a draft right now. Please try again.");
    }
    const data = await response.json();
    const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let draft;
    try {
      draft = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch {
      throw new HttpError(502, "The AI returned something unreadable. Please try again.");
    }
    if (draft.unknown) throw new HttpError(422, "The AI doesn't know this book well enough to draft it. You'll need to write this one yourself.");
    delete draft.unknown;
    if (!["skip", "skim", "read"].includes(draft.verdict)) draft.verdict = "skip";
    res.json({ draft });
  })
);

export default router;
