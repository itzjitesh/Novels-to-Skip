import { useState } from "react";
import { Link, NavLink, Route, Routes } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useToast } from "../lib/toast.jsx";
import { formatDate, timeAgo, useDebounced, useTitle, VERDICTS } from "../lib/hooks.js";
import { BookRow, Stamp } from "../components/Book.jsx";
import { Empty, ErrorState, Modal, Spinner, UserLink } from "../components/ui.jsx";

const FIELD_LABELS = {
  title: "Title",
  author: "Author",
  genres: "Genres",
  publishedYear: "Year published",
  pageCount: "Pages",
  coverUrl: "Cover image",
  theme: "What it's really about",
  keyPoints: "Key points",
  summary: "The story",
  spoilers: "How it ends",
  verdict: "Verdict",
  verdictReason: "Verdict reason",
};

const show = (field, v) => {
  if (v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length)) return <em className="faint">empty</em>;
  if (field === "keyPoints") return v.map((k, i) => `${i + 1}. ${k}`).join("\n");
  if (field === "genres") return v.join(", ");
  if (field === "verdict") return VERDICTS[v]?.label ?? v;
  return String(v);
};

function useAdminMutation(fn, success) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["books"] });
      if (success) toast(success);
    },
    onError: (e) => toast(e.message, "error"),
  });
}

function NoteModal({ title, label, confirm, required, onSubmit, onClose, pending }) {
  const [note, setNote] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(note);
        }}
      >
        <div className="field">
          <label htmlFor="note">{label}</label>
          <textarea id="note" className="textarea" rows={4} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <span className="hint">The writer sees this on their submissions page.</span>
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={pending || (required && !note.trim())}>
            {confirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Overview() {
  const { data } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get("/admin/stats") });
  if (!data) return null;
  return (
    <div className="stat-row">
      <div className={`stat${data.pendingBooks ? " alert" : ""}`}>
        <strong>{data.pendingBooks}</strong>
        <span>new summaries waiting</span>
      </div>
      <div className={`stat${data.pendingEdits ? " alert" : ""}`}>
        <strong>{data.pendingEdits}</strong>
        <span>edit suggestions waiting</span>
      </div>
      <div className="stat">
        <strong>{data.published}</strong>
        <span>live summaries</span>
      </div>
      <div className="stat">
        <strong>{data.users}</strong>
        <span>readers signed up</span>
      </div>
      <div className="stat">
        <strong>{data.views.toLocaleString()}</strong>
        <span>summary views</span>
      </div>
      <div className="stat">
        <strong>{data.comments}</strong>
        <span>comments</span>
      </div>
    </div>
  );
}

function Submissions() {
  const [status, setStatus] = useState("pending");
  const [rejecting, setRejecting] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "books", status], queryFn: () => api.get(`/admin/books?status=${status}`) });
  const approve = useAdminMutation((id) => api.post(`/admin/books/${id}/approve`), "Summary published");
  const reject = useAdminMutation(({ id, note }) => api.post(`/admin/books/${id}/reject`, { note }), "Sent back to the writer");

  return (
    <>
      <div className="chip-list" style={{ marginBottom: "1.25rem" }}>
        {["pending", "rejected", "published"].map((s) => (
          <button key={s} className={`chip${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>
            {s === "pending" ? "Waiting" : s === "rejected" ? "Sent back" : "Live"}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} />
      ) : data.books.length === 0 ? (
        <Empty title={status === "pending" ? "Nothing waiting for review" : "Nothing here"}>{status === "pending" ? "New summaries from readers will show up here." : null}</Empty>
      ) : (
        <div className="panel" style={{ padding: "0.25rem 1.25rem" }}>
          {data.books.map((b) => (
            <BookRow key={b.id} book={b}>
              <div className="small muted" style={{ textAlign: "right" }}>
                by <UserLink user={b.writer} />
                <br />
                {timeAgo(b.updatedAt)}
                {b.rejectionReason && status === "rejected" && <div className="faint">“{b.rejectionReason}”</div>}
              </div>
              <Stamp verdict={b.verdict} size="0.7rem" />
              {status !== "published" && (
                <>
                  <Link className="btn btn-sm" to={`/books/${b.slug}`}>
                    Read
                  </Link>
                  <Link className="btn btn-sm" to={`/books/${b.slug}/edit`}>
                    Edit
                  </Link>
                  {status === "pending" && (
                    <button className="btn btn-sm btn-danger" onClick={() => setRejecting(b)}>
                      Send back
                    </button>
                  )}
                  <button className="btn btn-sm btn-primary" disabled={approve.isPending} onClick={() => approve.mutate(b.id)}>
                    Publish
                  </button>
                </>
              )}
            </BookRow>
          ))}
        </div>
      )}
      {rejecting && (
        <NoteModal
          title={`Send back “${rejecting.title}”`}
          label="What should the writer fix?"
          confirm="Send back"
          required
          pending={reject.isPending}
          onClose={() => setRejecting(null)}
          onSubmit={(note) => reject.mutate({ id: rejecting.id, note }, { onSuccess: () => setRejecting(null) })}
        />
      )}
    </>
  );
}

function EditRequests() {
  const [status, setStatus] = useState("pending");
  const [modal, setModal] = useState(null);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "edits", status], queryFn: () => api.get(`/admin/edit-requests?status=${status}`) });
  const approve = useAdminMutation(({ id, note }) => api.post(`/admin/edit-requests/${id}/approve`, { note }), "Edit published");
  const reject = useAdminMutation(({ id, note }) => api.post(`/admin/edit-requests/${id}/reject`, { note }), "Suggestion declined");

  return (
    <>
      <div className="chip-list" style={{ marginBottom: "1.25rem" }}>
        {["pending", "approved", "rejected"].map((s) => (
          <button key={s} className={`chip${status === s ? " on" : ""}`} onClick={() => setStatus(s)}>
            {s === "pending" ? "Waiting" : s === "approved" ? "Published" : "Declined"}
          </button>
        ))}
      </div>
      {isLoading ? (
        <Spinner />
      ) : error ? (
        <ErrorState error={error} />
      ) : data.requests.length === 0 ? (
        <Empty title={status === "pending" ? "No suggestions waiting" : "Nothing here"}>{status === "pending" ? "When readers suggest edits to live summaries, they'll show up here." : null}</Empty>
      ) : (
        data.requests.map((r) => (
          <div className="queue-item" key={r.id}>
            <div className="spread">
              <div>
                <h3 style={{ fontSize: "var(--t-md)" }}>{r.book ? <Link to={`/books/${r.book.slug}`}>{r.book.title}</Link> : <em>Deleted summary</em>}</h3>
                <div className="small muted">
                  Suggested by <UserLink user={r.requestedBy} /> {timeAgo(r.createdAt)}
                  {r.reviewedAt && `, reviewed ${formatDate(r.reviewedAt)}`}
                </div>
              </div>
              {status === "pending" && r.book && (
                <div className="row">
                  <button className="btn btn-sm btn-danger" onClick={() => setModal({ type: "reject", r })}>
                    Decline
                  </button>
                  <button className="btn btn-sm btn-primary" onClick={() => setModal({ type: "approve", r })}>
                    Publish edit
                  </button>
                </div>
              )}
            </div>
            {r.message && (
              <p className="small" style={{ marginTop: "0.75rem" }}>
                <strong>Their note:</strong> {r.message}
              </p>
            )}
            {r.reviewNote && (
              <p className="small muted" style={{ marginTop: "0.5rem" }}>
                <strong>Review note:</strong> {r.reviewNote}
              </p>
            )}
            {r.stale && status === "pending" && (
              <div className="status-banner pending small" style={{ margin: "0.75rem 0 0" }}>
                The summary was edited after this suggestion was made. Check the current version before publishing, or it may overwrite newer changes.
              </div>
            )}
            <div className="diff">
              {Object.keys(r.changes).map((field) => (
                <div className="diff-field" key={field}>
                  <div>{FIELD_LABELS[field] ?? field}</div>
                  <div className="diff-cols">
                    <div className="diff-old" aria-label="Before">{show(field, r.original?.[field])}</div>
                    <div className="diff-new" aria-label="After">{show(field, r.changes[field])}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
      {modal && (
        <NoteModal
          title={modal.type === "approve" ? "Publish this edit?" : "Decline this suggestion?"}
          label={modal.type === "approve" ? "Thank-you note (optional)" : "Reason (optional)"}
          confirm={modal.type === "approve" ? "Publish edit" : "Decline"}
          pending={approve.isPending || reject.isPending}
          onClose={() => setModal(null)}
          onSubmit={(note) => (modal.type === "approve" ? approve : reject).mutate({ id: modal.r.id, note }, { onSuccess: () => setModal(null) })}
        />
      )}
    </>
  );
}

function Users() {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const dq = useDebounced(q);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "users", dq], queryFn: () => api.get(`/admin/users${qs({ q: dq })}`) });
  const update = useAdminMutation(({ id, ...body }) => api.patch(`/admin/users/${id}`, body), "User updated");
  return (
    <>
      <label htmlFor="user-q" className="sr-only">
        Search users
      </label>
      <input id="user-q" type="search" className="input" style={{ maxWidth: 360, marginBottom: "1.25rem" }} placeholder="Search by name, username or email" value={q} onChange={(e) => setQ(e.target.value)} />
      {isLoading ? (
        <Spinner />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Joined</th>
                <th>Role</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/u/${u.username}`}>{u.name}</Link> <span className="faint">@{u.username}</span>
                  </td>
                  <td>{u.email}</td>
                  <td>{formatDate(u.createdAt)}</td>
                  <td>
                    <span className={`pill ${u.role}`}>{u.role === "admin" ? "Admin" : "Reader"}</span> {u.isBanned && <span className="pill rejected">Suspended</span>}
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {String(u.id) !== String(me.id) && (
                      <>
                        <button className="btn btn-sm" onClick={() => update.mutate({ id: u.id, role: u.role === "admin" ? "user" : "admin" })}>
                          {u.role === "admin" ? "Remove admin" : "Make admin"}
                        </button>{" "}
                        <button className="btn btn-sm btn-danger" onClick={() => update.mutate({ id: u.id, isBanned: !u.isBanned })}>
                          {u.isBanned ? "Unsuspend" : "Suspend"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function Admin() {
  useTitle("Admin");
  const { data } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get("/admin/stats") });
  return (
    <>
      <div className="page-head">
        <h1>Admin dashboard</h1>
        <p>Review new summaries and edit suggestions, and manage readers.</p>
      </div>
      <Overview />
      <nav className="tabs" aria-label="Admin sections">
        <NavLink end to="/admin" className={({ isActive }) => (isActive ? "on" : "")}>
          New summaries{data?.pendingBooks ? <span className="badge-count">{data.pendingBooks}</span> : null}
        </NavLink>
        <NavLink to="/admin/edits" className={({ isActive }) => (isActive ? "on" : "")}>
          Edit suggestions{data?.pendingEdits ? <span className="badge-count">{data.pendingEdits}</span> : null}
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => (isActive ? "on" : "")}>
          Users
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<Submissions />} />
        <Route path="edits" element={<EditRequests />} />
        <Route path="users" element={<Users />} />
      </Routes>
    </>
  );
}
