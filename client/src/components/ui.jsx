import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { hashHue } from "./Book.jsx";

export function Spinner() {
  return <div className="spinner" role="status" aria-label="Loading" />;
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }) {
  return (
    <Empty title={error?.status === 404 ? "We couldn't find that" : "This page didn't load"} action={retry && <button className="btn" onClick={retry}>Try again</button>}>
      {error?.message}
    </Empty>
  );
}

export function Avatar({ user, size }) {
  if (!user) return <span className={`avatar${size === "lg" ? " avatar-lg" : ""}`} style={{ "--hue": 230 }}>?</span>;
  const initials = (user.name || user.username || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={`avatar${size === "lg" ? " avatar-lg" : ""}`} style={{ "--hue": hashHue(user.username || "") }}>
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : initials}
    </span>
  );
}

export function UserLink({ user }) {
  if (!user) return <span className="faint">deleted user</span>;
  return <Link to={`/u/${user.username}`}>{user.name}</Link>;
}

export function Field({ label, hint, error, id, children }) {
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      {children}
      {error ? <div className="error" id={`${id}-error`}>{error}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  );
}

export function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.querySelector("textarea, input, button")?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref}>
        <h2 id="modal-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Pages">
      <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="small muted">
        Page {page} of {pages}
      </span>
      <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </nav>
  );
}
