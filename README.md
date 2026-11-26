# Novels to Skip

**Read the summary. Skip the book.**

Novels to Skip is a community site for honest novel summaries. Each one covers what the book is really about, the key points, the story without spoilers, the ending behind a reveal button, and a verdict: **Skip it**, **Skim it** or **Read it**.

## Features

**Readers**
- Browse, search (title, author, genre) and filter by verdict and genre. Sort by newest, most liked, best rated or title.
- Book pages with key points, spoiler-safe story, a hidden ending, reading time and an estimate of the hours you save.
- Like, rate (1–5), save to your library, and put books on shelves: *Want to read*, *Reading*, *Finished*, *Skipped*.
- Comments with one level of replies.
- Public profiles, a library page, and dark mode.

**Writers**
- Any signed-up user can write a summary. It goes to the admin review queue before it's published.
- Drafts autosave in the browser.
- Optional **AI draft**: enter a title and Claude fills in every field for the writer to check and rewrite.
- **Suggest an edit** on any live summary. An admin sees the changes side by side with the original and publishes or declines them.
- A *Your submissions* page shows the status of everything sent, plus admin notes.

**Admins**
- A dashboard with live stats, a queue of new summaries (publish, edit, or send back with a reason), and edit suggestions with a before/after view. It warns you when a summary changed after the suggestion was made.
- Feature summaries on the home page, edit or delete anything, promote or suspend users.

**Under the hood**
- Each summary page includes SEO tags rendered on the server (title, description, Open Graph, JSON-LD), plus `sitemap.xml` and `robots.txt`.
- httpOnly cookie sessions, bcrypt passwords, rate-limited login and sign-up, Helmet security headers with a content security policy, and validation on every input (zod).

## Tech stack

| Part | Stack |
| --- | --- |
| Frontend | React 18, Vite, React Router, TanStack Query, plain CSS with design tokens |
| Backend | Node 22, Express, Mongoose (MongoDB), zod, JWT in httpOnly cookies |
| Fonts | Schibsted Grotesk (interface), Literata (summary text) |

```
client/          React app (Vite)
  src/pages/     One file per page
  src/components/
  src/styles/app.css   Design tokens and all styles
server/
  src/models/    User, Book, Comment, Rating, EditRequest
  src/routes/    auth, books, admin, ai, seo, misc (me/users/comments)
  scripts/       migrate-legacy, make-admin, seed
  test/          node:test + supertest
```

## Run it locally

You need Node 22.9+ and a MongoDB database. A free MongoDB Atlas cluster works, or run MongoDB locally.

```bash
npm run install:all
cp .env.example .env        # then fill in MONGO_URI and JWT_SECRET
npm run seed --prefix server   # optional: 6 sample summaries + an admin account
npm run dev:server          # API on http://localhost:5000
npm run dev:client          # app on http://localhost:5173
```

To become an admin, put your email in `ADMIN_EMAILS` before signing up, or run:

```bash
npm run make-admin --prefix server -- you@example.com
```

### Tests

```bash
npm test                                                        # unit and HTTP tests, no database needed
TEST_MONGO_URI=mongodb://127.0.0.1:27017/nts-test npm test      # also runs the full flow tests (wipes that DB)
```

## Moving data over from v1

v1 stored books as `{ title, description, bulletPoint, mainTheme }`, and users without usernames. With `MONGO_URI` pointing at the old database, run:

```bash
npm run migrate:legacy --prefix server
```

It's safe to run more than once. Old passwords keep working. Afterwards, open each migrated summary as an admin to add the author, genres and verdict.

## Deploy

The server serves both the API and the built React app, so the whole site is one web service.

**Render (blueprint included):** New → Blueprint → pick this repo. Then set `MONGO_URI`, `ADMIN_EMAILS` and `SITE_URL` (and optionally `ANTHROPIC_API_KEY`) in the dashboard.

**Any Node host:**

```bash
npm run build
NODE_ENV=production npm start
```

In MongoDB Atlas, allow your host's IP address under Network Access.

## Environment variables

See [`.env.example`](.env.example). `MONGO_URI` and `JWT_SECRET` are required in production.

---

Built by [Jitesh Singh](https://github.com/itzjitesh).
