import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useToast } from "../lib/toast.jsx";
import { formatDate, SHELVES, timeAgo, useTitle, VERDICTS } from "../lib/hooks.js";
import { BookGrid, Cover, Stamp } from "../components/Book.jsx";
import { Avatar, ErrorState, Modal, Spinner, UserLink } from "../components/ui.jsx";
import { IconBookmark, IconHeart, IconPen, IconShare, IconStar, IconTrash } from "../components/Icons.jsx";

const paragraphs = (text) =>
  String(text || "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

function Reading({ text }) {
  return (
    <div className="reading">
      {paragraphs(text).map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

function Stars({ value, onRate, disabled }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Rate this summary">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={value >= n ? "on" : ""}
          disabled={disabled}
          onClick={() => onRate(n === value ? null : n)}
        >
          <IconStar />
        </button>
      ))}
    </div>
  );
}

export default function BookPage() {
  const { slug } = useParams();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showSpoilers, setShowSpoilers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const key = ["book", slug, user?.id ?? null];

  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => api.get(`/books/slug/${slug}`) });
  const book = data?.book;
  useTitle(book ? `${book.title}${book.author ? ` by ${book.author}` : ""} — summary` : undefined, book?.theme);

  const patchBook = (patch) => qc.setQueryData(key, (d) => d && { ...d, book: { ...d.book, ...patch, viewer: { ...d.book.viewer, ...(patch.viewer || {}) } } });
  const requireLogin = () => {
    if (user) return false;
    navigate(`/login?next=${encodeURIComponent(`/books/${slug}`)}`);
    return true;
  };
  const onError = (e) => toast(e.message, "error");

  const like = useMutation({
    mutationFn: () => api.post(`/books/${book.id}/like`),
    onSuccess: (r) => patchBook({ likesCount: r.likesCount, viewer: { liked: r.liked } }),
    onError,
  });
  const bookmark = useMutation({
    mutationFn: () => api.post(`/books/${book.id}/bookmark`),
    onSuccess: (r) => {
      patchBook({ viewer: { bookmarked: r.bookmarked } });
      qc.invalidateQueries({ queryKey: ["library"] });
      toast(r.bookmarked ? "Saved to your library" : "Removed from your library");
    },
    onError,
  });
  const shelf = useMutation({
    mutationFn: (value) => api.put(`/books/${book.id}/shelf`, { shelf: value || null }),
    onSuccess: (r) => {
      patchBook({ viewer: { shelf: r.shelf } });
      qc.invalidateQueries({ queryKey: ["library"] });
    },
    onError,
  });
  const rate = useMutation({
    mutationFn: (value) => (value ? api.put(`/books/${book.id}/rating`, { value }) : api.del(`/books/${book.id}/rating`)),
    onSuccess: (r) => patchBook({ ratingAvg: r.ratingAvg, ratingCount: r.ratingCount, viewer: { rating: r.rating } }),
    onError,
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/books/${book.id}`),
    onSuccess: () => {
      toast("Summary deleted");
      qc.invalidateQueries();
      navigate("/books");
    },
    onError,
  });
  const feature = useMutation({
    mutationFn: () => api.post(`/admin/books/${book.id}/feature`),
    onSuccess: (r) => {
      patchBook({ featured: r.featured });
      qc.invalidateQueries({ queryKey: ["home"] });
      toast(r.featured ? "Featured on the home page" : "Removed from the home page");
    },
    onError,
  });

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: book.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} retry={refetch} />;

  const v = book.viewer;
  const verdict = VERDICTS[book.verdict];

  return (
    <article>
      {book.status !== "published" && (
        <div className={`status-banner ${book.status}`} role="status">
          {book.status === "pending" ? (
            <>
              <strong>Waiting for review.</strong> Only you{isAdmin ? ", the writer and other admins" : " and the admins"} can see this summary until it's approved.
            </>
          ) : (
            <>
              <strong>Not approved.</strong> {book.rejectionReason || "An admin sent this back."} Edit it and it goes back into the review queue.
            </>
          )}
        </div>
      )}

      <div className="book-layout">
        <aside className="book-aside">
          <Cover book={book} />
          <div className="stack" style={{ "--gap": "0.75rem" }}>
            {book.status === "published" && (
              <>
                <div className="field">
                  <label htmlFor="shelf">Your shelf</label>
                  <select
                    id="shelf"
                    className="select"
                    value={v?.shelf || ""}
                    onChange={(e) => !requireLogin() && shelf.mutate(e.target.value)}
                    onFocus={(e) => !user && (e.target.blur(), requireLogin())}
                  >
                    <option value="">Not on a shelf</option>
                    {Object.entries(SHELVES).map(([k, l]) => (
                      <option key={k} value={k}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="panel" style={{ padding: "1rem" }}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    {v?.rating ? "Your rating" : "Rate this summary"}
                  </div>
                  <Stars value={v?.rating ?? 0} disabled={rate.isPending} onRate={(n) => !requireLogin() && rate.mutate(n)} />
                  <div className="small faint" style={{ marginTop: 4 }}>
                    {book.ratingCount ? `${book.ratingAvg.toFixed(1)} average from ${book.ratingCount} rating${book.ratingCount === 1 ? "" : "s"}` : "No ratings yet"}
                  </div>
                </div>
              </>
            )}
          </div>
        </aside>

        <div>
          <header className="book-head">
            <h1>{book.title}</h1>
            <p className="byline">
              {book.author ? <>by <Link to={`/books?q=${encodeURIComponent(book.author)}`}>{book.author}</Link></> : "Author unknown"}
              {book.publishedYear ? `, ${book.publishedYear}` : ""}
            </p>
            {book.genres.length > 0 && (
              <div className="chip-list" style={{ marginTop: "1rem" }}>
                {book.genres.map((g) => (
                  <Link key={g} to={`/books?genre=${encodeURIComponent(g)}`} className="chip">
                    {g}
                  </Link>
                ))}
              </div>
            )}

            <dl className="facts">
              <div>
                <dt>Summary read</dt>
                <dd>{book.readingTime} min</dd>
              </div>
              {book.pageCount && (
                <div>
                  <dt>Book length</dt>
                  <dd>{book.pageCount} pages</dd>
                </div>
              )}
              {book.hoursSaved > 0 && (
                <div>
                  <dt>Time you save</dt>
                  <dd>≈ {book.hoursSaved} hours</dd>
                </div>
              )}
              <div>
                <dt>Summary by</dt>
                <dd style={{ fontWeight: 600 }}>
                  <UserLink user={book.writer} />
                </dd>
              </div>
            </dl>

            <div className={`verdict-card v-${book.verdict}`}>
              <Stamp verdict={book.verdict} tilted />
              <div>
                <strong>{verdict.help}</strong>
                {book.verdictReason && <p className="muted" style={{ marginTop: 4 }}>{book.verdictReason}</p>}
              </div>
            </div>

            <div className="action-bar">
              {book.status === "published" && (
                <>
                  <button className={`btn${v?.liked ? " on" : ""}`} aria-pressed={!!v?.liked} onClick={() => !requireLogin() && like.mutate()} disabled={like.isPending}>
                    <IconHeart fill={v?.liked ? "currentColor" : "none"} /> {book.likesCount > 0 ? book.likesCount : "Like"}
                  </button>
                  <button className={`btn${v?.bookmarked ? " on" : ""}`} aria-pressed={!!v?.bookmarked} onClick={() => !requireLogin() && bookmark.mutate()} disabled={bookmark.isPending}>
                    <IconBookmark fill={v?.bookmarked ? "currentColor" : "none"} /> {v?.bookmarked ? "Saved" : "Save"}
                  </button>
                  <button className="btn" onClick={share}>
                    <IconShare /> Share
                  </button>
                </>
              )}
              {v?.canEdit && (
                <Link className="btn" to={`/books/${book.slug}/edit`}>
                  <IconPen /> Edit
                </Link>
              )}
              {(v?.canSuggestEdit || (!user && book.status === "published")) && (
                <Link className="btn" to={user ? `/books/${book.slug}/suggest` : `/login?next=/books/${book.slug}/suggest`}>
                  <IconPen /> Suggest an edit
                </Link>
              )}
              {isAdmin && book.status === "published" && (
                <button className={`btn${book.featured ? " on" : ""}`} onClick={() => feature.mutate()}>
                  {book.featured ? "Featured" : "Feature on home"}
                </button>
              )}
              {v?.canDelete && (
                <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
                  <IconTrash /> Delete
                </button>
              )}
            </div>
          </header>

          <section className="reading-section">
            <h2>What it's really about</h2>
            <p className="theme-quote">{book.theme}</p>
          </section>

          {book.keyPoints.length > 0 && (
            <section className="reading-section">
              <h2>Key points</h2>
              <ol className="key-points">
                {book.keyPoints.map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ol>
            </section>
          )}

          <section className="reading-section">
            <h2>The story</h2>
            <Reading text={book.summary} />
          </section>

          {book.spoilers && (
            <section className="reading-section">
              <h2>How it ends</h2>
              <div className={`spoiler-box${showSpoilers ? " revealed" : ""}`}>
                {showSpoilers ? (
                  <>
                    <Reading text={book.spoilers} />
                    <button className="btn btn-sm" style={{ marginTop: "1rem" }} onClick={() => setShowSpoilers(false)}>
                      Hide the ending
                    </button>
                  </>
                ) : (
                  <div className="spread">
                    <p className="muted">This part gives away the ending and the big twists.</p>
                    <button className="btn" onClick={() => setShowSpoilers(true)}>
                      Show the ending
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          <p className="small faint" style={{ marginTop: "2.5rem" }}>
            {book.publishedAt ? `Published ${formatDate(book.publishedAt)}` : `Submitted ${formatDate(book.createdAt)}`}
            {book.updatedAt && book.publishedAt && new Date(book.updatedAt) - new Date(book.publishedAt) > 86400000 && `, updated ${formatDate(book.updatedAt)}`}
          </p>

          {book.status === "published" && <Comments bookId={book.id} slug={slug} />}
        </div>
      </div>

      {data.related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>If you liked this summary</h2>
          </div>
          <BookGrid books={data.related} />
        </section>
      )}

      {confirmDelete && (
        <Modal title="Delete this summary?" onClose={() => setConfirmDelete(false)}>
          <p className="muted">“{book.title}” and all its comments, ratings and edit suggestions will be removed. This can't be undone.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button className="btn btn-danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
              Delete summary
            </button>
          </div>
        </Modal>
      )}
    </article>
  );
}

function CommentForm({ bookId, parent, onDone, autoFocus }) {
  const [body, setBody] = useState("");
  const qc = useQueryClient();
  const toast = useToast();
  const post = useMutation({
    mutationFn: () => api.post(`/books/${bookId}/comments`, { body, parent }),
    onSuccess: () => {
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", bookId] });
      onDone?.();
    },
    onError: (e) => toast(e.message, "error"),
  });
  return (
    <form
      className="stack"
      style={{ "--gap": "0.5rem" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) post.mutate();
      }}
    >
      <label htmlFor={`c-${parent || "new"}`} className="sr-only">
        {parent ? "Your reply" : "Your comment"}
      </label>
      <textarea
        id={`c-${parent || "new"}`}
        className="textarea"
        rows={parent ? 2 : 3}
        maxLength={2000}
        placeholder={parent ? "Write a reply" : "Did the summary help? Did you read the book anyway?"}
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={!body.trim() || post.isPending}>
          {parent ? "Post reply" : "Post comment"}
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Comments({ bookId, slug }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [replyTo, setReplyTo] = useState(null);
  const { data } = useQuery({ queryKey: ["comments", bookId, user?.id], queryFn: () => api.get(`/books/${bookId}/comments`) });
  const del = useMutation({
    mutationFn: (id) => api.del(`/comments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", bookId] }),
    onError: (e) => toast(e.message, "error"),
  });

  const all = data?.comments ?? [];
  const top = all.filter((c) => !c.parent);
  const repliesOf = (id) => all.filter((c) => String(c.parent) === String(id));
  const visibleCount = all.filter((c) => !c.deleted).length;

  const renderComment = (c, isReply) => (
    <div className="comment" key={c.id}>
      <Avatar user={c.user} />
      <div>
        <div className="small">
          {c.deleted ? <span className="faint">Deleted comment</span> : <strong><UserLink user={c.user} /></strong>}{" "}
          <span className="faint">{timeAgo(c.createdAt)}</span>
        </div>
        {!c.deleted && <p className="body">{c.body}</p>}
        <div className="row" style={{ gap: 0, marginTop: 2 }}>
          {user && !isReply && !c.deleted && (
            <button className="btn btn-ghost btn-sm" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>
              Reply
            </button>
          )}
          {c.canDelete && (
            <button className="btn btn-ghost btn-sm btn-danger" onClick={() => del.mutate(c.id)}>
              Delete
            </button>
          )}
        </div>
        {!isReply && (
          <div className="replies">
            {repliesOf(c.id).map((r) => renderComment(r, true))}
            {replyTo === c.id && <CommentForm bookId={bookId} parent={c.id} autoFocus onDone={() => setReplyTo(null)} />}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="reading-section" aria-labelledby="comments-h">
      <h2 id="comments-h">
        Discussion {visibleCount > 0 && <span className="faint">({visibleCount})</span>}
      </h2>
      <div className="comments">
        {user ? (
          <CommentForm bookId={bookId} />
        ) : (
          <p className="muted">
            <Link to={`/login?next=/books/${slug}`}>Log in</Link> to join the discussion.
          </p>
        )}
        {top.map((c) => renderComment(c, false))}
        {data && top.length === 0 && <p className="faint">No comments yet.</p>}
      </div>
    </section>
  );
}
