import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useToast } from "../lib/toast.jsx";
import { useTitle, VERDICTS } from "../lib/hooks.js";
import { Cover, Stamp } from "../components/Book.jsx";
import { ErrorState, Field, Spinner } from "../components/ui.jsx";
import { IconDown, IconSparkle, IconUp, IconX } from "../components/Icons.jsx";

const EMPTY = {
  title: "",
  author: "",
  genres: [],
  publishedYear: "",
  pageCount: "",
  coverUrl: "",
  theme: "",
  keyPoints: ["", "", ""],
  summary: "",
  spoilers: "",
  verdict: "skip",
  verdictReason: "",
};
const FIELDS = Object.keys(EMPTY);
const DRAFT_KEY = "nts-draft-new";

function fromBook(b) {
  return {
    ...EMPTY,
    ...Object.fromEntries(FIELDS.map((f) => [f, b[f] ?? EMPTY[f]])),
    publishedYear: b.publishedYear ?? "",
    pageCount: b.pageCount ?? "",
    keyPoints: b.keyPoints?.length ? [...b.keyPoints] : [""],
  };
}

/** Converts form state to the API shape. */
function toPayload(f) {
  const num = (v) => (v === "" || v === null ? null : Number(v));
  return {
    ...f,
    publishedYear: num(f.publishedYear),
    pageCount: num(f.pageCount),
    keyPoints: f.keyPoints.map((k) => k.trim()).filter(Boolean),
  };
}

function TagInput({ id, value, onChange, max = 6 }) {
  const [text, setText] = useState("");
  const add = (raw) => {
    const tags = raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (!tags.length) return;
    onChange([...new Set([...value, ...tags])].slice(0, max));
    setText("");
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <span className="tag" key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
            ×
          </button>
        </span>
      ))}
      {value.length < max && (
        <input
          id={id}
          value={text}
          placeholder={value.length ? "Add another" : "e.g. classic, romance"}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(text)}
        />
      )}
    </div>
  );
}

function ListEditor({ value, onChange, error }) {
  const set = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)));
  const move = (i, d) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="list-editor">
      {value.map((item, i) => (
        <div className="item" key={i}>
          <span className="num">{i + 1}</span>
          <input
            className="input"
            aria-label={`Key point ${i + 1}`}
            value={item}
            maxLength={400}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (value.length < 20) onChange([...value.slice(0, i + 1), "", ...value.slice(i + 1)]);
              }
            }}
          />
          <div className="row" style={{ gap: 2 }}>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
              <IconUp />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Move down" disabled={i === value.length - 1} onClick={() => move(i, 1)}>
              <IconDown />
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-icon" aria-label="Remove point" disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <IconX />
            </button>
          </div>
        </div>
      ))}
      {error && <div className="error small">{error}</div>}
      {value.length < 20 && (
        <button type="button" className="btn btn-sm" style={{ justifySelf: "start" }} onClick={() => onChange([...value, ""])}>
          Add a point
        </button>
      )}
    </div>
  );
}

function AiDraft({ title, author, onDraft }) {
  const toast = useToast();
  const status = useQuery({ queryKey: ["ai-status"], queryFn: () => api.get("/ai/status"), staleTime: Infinity });
  const draft = useMutation({
    mutationFn: () => api.post("/ai/draft", { title, author }),
    onSuccess: (r) => {
      onDraft(r.draft);
      toast("Draft filled in. Check every detail before you submit.");
    },
    onError: (e) => toast(e.message, "error"),
  });
  if (!status.data?.enabled) return null;
  return (
    <div className="ai-box">
      <div className="row" style={{ gap: "0.5rem" }}>
        <IconSparkle />
        <strong>Start from an AI draft</strong>
      </div>
      <p className="small muted">Enter the title (and author if you know it). The AI fills in every field for you to check and rewrite. It can get details wrong.</p>
      <button type="button" className="btn btn-primary btn-sm" disabled={!title.trim() || draft.isPending} onClick={() => draft.mutate()}>
        {draft.isPending ? "Writing the draft…" : "Draft it for me"}
      </button>
    </div>
  );
}

export default function WriteBook({ mode }) {
  const { slug } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const editing = mode !== "create";

  useTitle(mode === "create" ? "Write a summary" : mode === "edit" ? "Edit summary" : "Suggest an edit");

  const existing = useQuery({
    queryKey: ["book-edit", slug],
    queryFn: () => api.get(`/books/slug/${slug}`),
    enabled: editing,
    staleTime: 0,
  });
  const book = existing.data?.book;

  const [form, setForm] = useState(() => {
    if (editing) return EMPTY;
    try {
      return { ...EMPTY, ...JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") };
    } catch {
      return EMPTY;
    }
  });
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(!editing);

  useEffect(() => {
    if (book && !loaded) {
      setForm(fromBook(book));
      setLoaded(true);
    }
  }, [book, loaded]);

  // Keep an unsent new summary in the browser so a refresh doesn't lose it.
  useEffect(() => {
    if (mode !== "create") return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        /* storage full or unavailable */
      }
    }, 500);
    return () => clearTimeout(t);
  }, [form, mode]);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value?.target ? value.target.value : value }));

  const original = useMemo(() => (book ? toPayload(fromBook(book)) : null), [book]);
  const changedFields = useMemo(() => {
    if (!original) return [];
    const now = toPayload(form);
    return FIELDS.filter((k) => JSON.stringify(now[k] ?? null) !== JSON.stringify(original[k] ?? null));
  }, [form, original]);

  const save = useMutation({
    mutationFn: () => {
      const payload = toPayload(form);
      if (mode === "create") return api.post("/books", payload);
      const changes = Object.fromEntries(changedFields.map((k) => [k, payload[k]]));
      if (mode === "edit") return api.patch(`/books/${book.id}`, changes);
      return api.post(`/books/${book.id}/edit-requests`, { changes, message });
    },
    onSuccess: (r) => {
      qc.invalidateQueries();
      if (mode === "create") {
        localStorage.removeItem(DRAFT_KEY);
        toast(r.book.status === "published" ? "Summary published" : "Summary sent for review");
        navigate(`/books/${r.book.slug}`);
      } else if (mode === "edit") {
        toast("Changes saved");
        navigate(`/books/${r.book.slug}`);
      } else {
        toast("Edit suggestion sent. An admin will review it.");
        navigate("/me/submissions");
      }
    },
    onError: (e) => {
      toast(e.message, "error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  if (editing && existing.isLoading) return <Spinner />;
  if (editing && existing.error) return <ErrorState error={existing.error} />;
  if (mode === "edit" && book && !book.viewer?.canEdit) {
    return <ErrorState error={{ message: "You can't edit this summary directly. Use Suggest an edit on its page instead." }} />;
  }

  const errors = save.error?.details || {};
  const errFor = (name) => errors[name] || errors[`changes.${name}`];
  const unchanged = editing && changedFields.length === 0;

  const heading = {
    create: { title: "Write a summary", sub: isAdmin ? "As an admin, your summary goes live as soon as you publish it." : "An admin reviews new summaries before they go live, usually within a day or two." },
    edit: { title: `Edit “${book?.title ?? ""}”`, sub: isAdmin ? "Your changes go live as soon as you save." : "Your summary isn't live yet, so you can change anything." },
    suggest: { title: `Suggest an edit to “${book?.title ?? ""}”`, sub: "Change whatever needs fixing. An admin sees your changes next to the original and publishes them if they're right." },
  }[mode];
  const submitLabel = mode === "create" ? (isAdmin ? "Publish summary" : "Send for review") : mode === "edit" ? "Save changes" : "Send suggestion";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="page-head">
        <h1>{heading.title}</h1>
        <p>{heading.sub}</p>
      </div>
      {save.error && (
        <div className="form-error" role="alert" style={{ marginBottom: "1.5rem" }}>
          {save.error.message}
        </div>
      )}

      <div className="write-layout">
        <div>
          <section className="form-section">
            <h2>The book</h2>
            <div className="grid-2">
              <Field id="title" label="Title" error={errFor("title")}>
                <input id="title" className="input" value={form.title} onChange={set("title")} maxLength={200} aria-invalid={!!errFor("title")} />
              </Field>
              <Field id="author" label="Author" error={errFor("author")}>
                <input id="author" className="input" value={form.author} onChange={set("author")} maxLength={120} />
              </Field>
            </div>
            <div className="grid-3">
              <Field id="publishedYear" label="Year published" error={errFor("publishedYear")}>
                <input id="publishedYear" className="input" inputMode="numeric" value={form.publishedYear} onChange={set("publishedYear")} />
              </Field>
              <Field id="pageCount" label="Pages" hint="Used to work out the hours saved." error={errFor("pageCount")}>
                <input id="pageCount" className="input" inputMode="numeric" value={form.pageCount} onChange={set("pageCount")} />
              </Field>
              <Field id="genres" label="Genres" hint="Up to 6. Press Enter after each." error={errFor("genres")}>
                <TagInput id="genres" value={form.genres} onChange={set("genres")} />
              </Field>
            </div>
            <Field id="coverUrl" label="Cover image link (optional)" hint="Leave empty and we'll design a cover from the title." error={errFor("coverUrl")}>
              <input id="coverUrl" className="input" type="url" placeholder="https://…" value={form.coverUrl} onChange={set("coverUrl")} />
            </Field>
          </section>

          <section className="form-section">
            <h2>The summary</h2>
            <Field id="theme" label="What it's really about" hint="One or two sentences. This shows on cards and in search results." error={errFor("theme")}>
              <textarea id="theme" className="textarea reading" rows={3} maxLength={600} value={form.theme} onChange={set("theme")} aria-invalid={!!errFor("theme")} />
            </Field>
            <div className="field">
              <span className="label">Key points</span>
              <span className="hint">Short takeaways, one per line. Press Enter to add the next one.</span>
              <ListEditor value={form.keyPoints} onChange={set("keyPoints")} error={errFor("keyPoints")} />
            </div>
            <Field id="summary" label="The story" hint="Tell the plot without giving away the ending. Leave a blank line between paragraphs." error={errFor("summary")}>
              <textarea id="summary" className="textarea reading" rows={14} value={form.summary} onChange={set("summary")} aria-invalid={!!errFor("summary")} />
            </Field>
            <Field id="spoilers" label="How it ends (optional)" hint="The ending and big twists. Readers see this only if they choose to." error={errFor("spoilers")}>
              <textarea id="spoilers" className="textarea reading" rows={5} value={form.spoilers} onChange={set("spoilers")} />
            </Field>
          </section>

          <section className="form-section">
            <h2>Your verdict</h2>
            <div className="verdict-picker" role="radiogroup" aria-label="Verdict">
              {Object.entries(VERDICTS).map(([k, v]) => (
                <label key={k} className="verdict-option">
                  <input type="radio" name="verdict" value={k} checked={form.verdict === k} onChange={set("verdict")} />
                  <Stamp verdict={k} />
                  <span>{v.help}</span>
                </label>
              ))}
            </div>
            <Field id="verdictReason" label="Why?" hint="One sentence readers will see next to the verdict." error={errFor("verdictReason")}>
              <input id="verdictReason" className="input" maxLength={400} value={form.verdictReason} onChange={set("verdictReason")} />
            </Field>
          </section>

          {mode === "suggest" && (
            <section className="form-section">
              <h2>Note for the admin</h2>
              <Field id="message" label="What did you change and why? (optional)">
                <textarea id="message" className="textarea" rows={3} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} />
              </Field>
            </section>
          )}

          <div className="row">
            <button className="btn btn-primary" disabled={save.isPending || unchanged}>
              {save.isPending ? "Saving…" : submitLabel}
            </button>
            <Link className="btn btn-ghost" to={editing ? `/books/${slug}` : "/"}>
              Cancel
            </Link>
            {editing && <span className="small muted">{unchanged ? "No changes yet" : `${changedFields.length} field${changedFields.length === 1 ? "" : "s"} changed`}</span>}
          </div>
        </div>

        <aside className="write-side">
          {mode === "create" && (
            <AiDraft
              title={form.title}
              author={form.author}
              onDraft={(d) =>
                setForm((f) => ({
                  ...f,
                  ...Object.fromEntries(Object.entries(d).filter(([k, v]) => FIELDS.includes(k) && v !== null && v !== undefined && v !== "")),
                  author: f.author || d.author || "",
                  keyPoints: d.keyPoints?.length ? d.keyPoints : f.keyPoints,
                  publishedYear: d.publishedYear ?? f.publishedYear,
                  pageCount: d.pageCount ?? f.pageCount,
                }))
              }
            />
          )}
          <div>
            <div className="label" style={{ marginBottom: 8 }}>
              Cover preview
            </div>
            <div style={{ maxWidth: 220 }}>
              <Cover book={{ title: form.title || "Your title", author: form.author, coverUrl: form.coverUrl, verdict: form.verdict }} />
            </div>
          </div>
          <div className="panel small">
            <h3>Tips for a good summary</h3>
            <ul className="muted" style={{ paddingLeft: "1.1rem", margin: 0, display: "grid", gap: 6 }}>
              <li>Write in your own words. Don't copy text from the book or other sites.</li>
              <li>Keep the ending in the spoilers box.</li>
              <li>Be honest in the verdict — that's what readers come for.</li>
            </ul>
          </div>
        </aside>
      </div>
    </form>
  );
}
