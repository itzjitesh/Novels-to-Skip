import { Router } from "express";
import fs from "node:fs";
import config from "../config.js";
import Book from "../models/Book.js";
import { asyncHandler } from "../utils/http.js";
import { excerpt } from "../utils/text.js";

const router = Router();

const xmlEscape = (s) =>
  String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

router.get("/robots.txt", (req, res) => {
  res.type("text/plain").send(
    ["User-agent: *", "Allow: /", "Disallow: /admin", "Disallow: /me", "Disallow: /write", `Sitemap: ${config.siteUrl}/sitemap.xml`].join("\n")
  );
});

router.get(
  "/sitemap.xml",
  asyncHandler(async (req, res) => {
    const books = await Book.find({ status: "published" }).select("slug updatedAt").sort({ publishedAt: -1 }).limit(45000).lean();
    const urls = [
      { loc: "/", priority: "1.0" },
      { loc: "/books", priority: "0.8" },
      { loc: "/about", priority: "0.3" },
      ...books.map((b) => ({ loc: `/books/${b.slug}`, lastmod: b.updatedAt?.toISOString(), priority: "0.7" })),
    ];
    const body = urls
      .map(
        (u) =>
          `  <url><loc>${xmlEscape(config.siteUrl + u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<priority>${u.priority}</priority></url>`
      )
      .join("\n");
    res
      .type("application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>`);
  })
);

const htmlEscape = (s) =>
  String(s ?? "").replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c]);

/**
 * Serves the built React app. For book pages it fills in the title, description,
 * Open Graph tags and JSON-LD so search engines and link previews see real content.
 */
export function spaHandler(indexPath) {
  let template = null;
  const load = () => (template ??= fs.readFileSync(indexPath, "utf8"));

  return asyncHandler(async (req, res) => {
    let html = load();
    const match = req.path.match(/^\/books\/([a-z0-9-]+)\/?$/);
    if (match) {
      // If the lookup fails, still serve the app; it will load the book itself.
      const book = await Book.findOne({ slug: match[1], status: "published" })
        .lean()
        .catch(() => undefined);
      if (book) {
        const title = `${book.title}${book.author ? ` by ${book.author}` : ""} — Summary | Novels to Skip`;
        const description = excerpt(book.theme, 155);
        const url = `${config.siteUrl}/books/${book.slug}`;
        const ld = {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: `${book.title} summary`,
          description,
          url,
          datePublished: book.publishedAt,
          dateModified: book.updatedAt,
          ...(book.coverUrl ? { image: book.coverUrl } : {}),
          about: { "@type": "Book", name: book.title, ...(book.author ? { author: { "@type": "Person", name: book.author } } : {}) },
          ...(book.ratingCount
            ? { aggregateRating: { "@type": "AggregateRating", ratingValue: book.ratingAvg, ratingCount: book.ratingCount } }
            : {}),
        };
        const tags = [
          `<title>${htmlEscape(title)}</title>`,
          `<meta name="description" content="${htmlEscape(description)}" />`,
          `<link rel="canonical" href="${htmlEscape(url)}" />`,
          `<meta property="og:type" content="article" />`,
          `<meta property="og:title" content="${htmlEscape(title)}" />`,
          `<meta property="og:description" content="${htmlEscape(description)}" />`,
          `<meta property="og:url" content="${htmlEscape(url)}" />`,
          book.coverUrl ? `<meta property="og:image" content="${htmlEscape(book.coverUrl)}" />` : "",
          `<meta name="twitter:card" content="summary_large_image" />`,
          `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
        ].join("\n    ");
        html = html.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<meta name="description"[^>]*>/, "").replace("</head>", `    ${tags}\n  </head>`);
      } else if (book === null) {
        res.status(404);
      }
    }
    res.type("html").send(html);
  });
}

export default router;
