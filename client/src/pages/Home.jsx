import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useTitle, VERDICTS } from "../lib/hooks.js";
import { BookGrid, BookGridSkeleton, Cover, Stamp } from "../components/Book.jsx";
import { Empty, ErrorState } from "../components/ui.jsx";
import { IconSearch } from "../components/Icons.jsx";

export default function Home() {
  useTitle();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["home"], queryFn: () => api.get("/books/home") });

  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/books?q=${encodeURIComponent(q.trim())}` : "/books");
  };

  return (
    <>
      <section className="hero">
        <div>
          <h1>
            Read the summary.
            <br />
            <span className="strike">Skip</span> the book.
          </h1>
          <p className="hero-lede">
            Honest, spoiler-safe summaries of novels — what happens, what it means, and a clear verdict on whether the full book is worth your time.
          </p>
          <form className="hero-search" onSubmit={submit} role="search">
            <label htmlFor="hero-q" className="sr-only">
              Search by title, author or genre
            </label>
            <input id="hero-q" className="input" placeholder="Search a title, author or genre" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-ink" type="submit">
              <IconSearch /> Search
            </button>
          </form>
          {data?.stats?.books > 0 && (
            <div className="hero-facts">
              <div>
                <strong>{data.stats.books}</strong> summaries
              </div>
              {data.stats.hoursSaved > 0 && (
                <div>
                  <strong>{data.stats.hoursSaved.toLocaleString()}</strong> hours of reading saved
                </div>
              )}
            </div>
          )}
        </div>
        <div className="hero-stack" aria-label="Featured summaries">
          {(data?.featured ?? []).slice(0, 3).map((b) => (
            <Link key={b.id} to={`/books/${b.slug}`} aria-label={b.title}>
              <Cover book={b} />
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="verdict-key">
          {Object.entries(VERDICTS).map(([k, v]) => (
            <div key={k}>
              <Stamp verdict={k} tilted />
              <p className="muted">{v.help}</p>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <div className="section">
          <ErrorState error={error} retry={refetch} />
        </div>
      ) : isLoading ? (
        <section className="section">
          <BookGridSkeleton />
        </section>
      ) : data.latest.length === 0 ? (
        <section className="section">
          <Empty
            title="No summaries yet"
            action={user ? <Link className="btn btn-primary" to="/write">Write the first one</Link> : <Link className="btn btn-primary" to="/register">Sign up to write the first one</Link>}
          >
            This shelf is empty for now.
          </Empty>
        </section>
      ) : (
        <>
          <section className="section">
            <div className="section-head">
              <h2>Just added</h2>
              <Link to="/books">See all summaries</Link>
            </div>
            <BookGrid books={data.latest.slice(0, 6)} />
          </section>
          {data.popular.some((b) => b.likesCount > 0) && (
            <section className="section">
              <div className="section-head">
                <h2>Readers' favourites</h2>
                <Link to="/books?sort=popular">See more</Link>
              </div>
              <BookGrid books={data.popular} />
            </section>
          )}
          {data.topRated.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>Best-rated summaries</h2>
                <Link to="/books?sort=top">See more</Link>
              </div>
              <BookGrid books={data.topRated} />
            </section>
          )}
        </>
      )}

      {!user && (
        <section className="section">
          <div className="panel spread" style={{ padding: "1.75rem" }}>
            <div>
              <h2 style={{ fontSize: "var(--t-xl)" }}>Read a book someone else should skip?</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Sign up to write summaries, suggest fixes, rate and save books to your library.
              </p>
            </div>
            <Link to="/register" className="btn btn-primary">
              Create a free account
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
