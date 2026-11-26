import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../lib/auth.jsx";
import { useTheme } from "../lib/hooks.js";
import { api } from "../lib/api.js";
import { Avatar } from "./ui.jsx";
import { IconMenu, IconMoon, IconPen, IconSun } from "./Icons.jsx";

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="12" fill="var(--ink)" />
      <rect x="16" y="12" width="26" height="40" rx="3" fill="var(--paper)" />
      <rect x="20" y="18" width="14" height="3" rx="1.5" fill="var(--ink)" />
      <rect x="20" y="24" width="10" height="3" rx="1.5" fill="var(--ink)" />
      <g transform="rotate(-14 40 40)">
        <rect x="26" y="33" width="30" height="13" rx="3" fill="none" stroke="var(--skip)" strokeWidth="3.5" />
      </g>
    </svg>
  );
}

function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="dropdown" ref={ref}>
      <button className="btn btn-ghost" style={{ padding: 4, borderRadius: 999 }} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu">
        <Avatar user={user} />
      </button>
      {open && (
        <div className="dropdown-menu" onClick={() => setOpen(false)}>
          <div className="who">
            Signed in as <strong>@{user.username}</strong>
          </div>
          <hr />
          <Link to="/write">Write a summary</Link>
          <Link to={`/u/${user.username}`}>Your profile</Link>
          <Link to="/me/library">Your library</Link>
          <Link to="/me/submissions">Your submissions</Link>
          {isAdmin && <Link to="/admin">Admin dashboard</Link>}
          <Link to="/me/settings">Settings</Link>
          <hr />
          <button onClick={() => logout.mutate(undefined, { onSuccess: () => navigate("/") })}>Log out</button>
        </div>
      )}
    </div>
  );
}

function AdminBadge() {
  const { data } = useQuery({ queryKey: ["admin", "stats"], queryFn: () => api.get("/admin/stats"), refetchInterval: 60_000 });
  const n = (data?.pendingBooks ?? 0) + (data?.pendingEdits ?? 0);
  return (
    <NavLink to="/admin">
      Review{n > 0 && <span className="badge-count" aria-label={`${n} waiting`}>{n}</span>}
    </NavLink>
  );
}

export default function Layout() {
  const { user, isAdmin, loading } = useAuth();
  const [theme, toggleTheme] = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap">
          <Link to="/" className="brand" aria-label="Novels to Skip home">
            <BrandMark />
            <span>Novels to Skip</span>
          </Link>
          <nav className={`nav${menuOpen ? " open" : ""}`} aria-label="Main">
            <NavLink to="/books">Browse</NavLink>
            <NavLink to="/about">How it works</NavLink>
            {isAdmin && <AdminBadge />}
          </nav>
          <div className="header-actions" style={{ marginLeft: "auto" }}>
            <button className="btn btn-ghost btn-icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            {!loading && (user ? (
              <>
                <Link to="/write" className="btn btn-primary hide-mobile">
                  <IconPen /> Write a summary
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost">
                  Log in
                </Link>
                <Link to="/register" className="btn btn-primary hide-mobile">
                  Sign up
                </Link>
              </>
            ))}
            <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label="Menu">
              <IconMenu />
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <div className="wrap">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <div>
            <strong>Novels to Skip</strong> — read the summary, skip the book.
            <div className="faint" style={{ marginTop: 4 }}>Built by Jitesh Singh.</div>
          </div>
          <nav aria-label="Footer">
            <Link to="/books">Browse</Link>
            <Link to="/about">How it works</Link>
            {user && <Link to="/write">Write a summary</Link>}
            <a href="https://github.com/itzjitesh" target="_blank" rel="noreferrer">GitHub</a>
            <a href="https://www.linkedin.com/in/singhjitesh/" target="_blank" rel="noreferrer">LinkedIn</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

export function RequireAuth({ children, admin }) {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const blocked = !loading && (!user || (admin && !isAdmin));
  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(pathname)}`, { replace: true });
  }, [loading, user, navigate, pathname]);
  if (loading || !user) return null;
  if (blocked) return <p className="muted">This page is for admins only.</p>;
  return children;
}
