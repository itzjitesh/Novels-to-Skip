import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api, qs } from "../lib/api.js";
import { useDebounced, useTitle, VERDICTS } from "../lib/hooks.js";
import { BookGrid, BookGridSkeleton, Stamp } from "../components/Book.jsx";
import { Empty, ErrorState, Pagination } from "../components/ui.jsx";

const SORT_LABELS = { newest: "Newest", popular: "Most liked", top: "Best rated", title: "Title A–Z", oldest: "Oldest" };

export default function Explore() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const genre = params.get("genre") || "";
  const verdict = params.get("verdict") || "";
  const sort = params.get("sort") || "newest";
  const page = Number(params.get("page")) || 1;

  const [search, setSearch] = useState(q);
  const debounced = useDebounced(search, 350);
  useTitle(q ? `Search: ${q}` : genre ? `${genre} summaries` : "Browse summaries");

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
    if (!("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== q) update({ q: debounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  useEffect(() => setSearch(q), [q]);

  const query = { q, genre, verdict, sort, page };
  const list = useQuery({ queryKey: ["books", query], queryFn: () => api.get(`/books${qs(query)}`), placeholderData: keepPreviousData });
  const genres = useQuery({ queryKey: ["genres"], queryFn: () => api.get("/books/genres"), staleTime: 5 * 60_000 });

  const filtering = q || genre || verdict;

  return (
    <>
      <div className="page-head">
        <h1>Browse summaries</h1>
        <p>Find a novel and decide in five minutes whether it deserves your next twenty hours.</p>
      </div>
      <div className="explore">
        <aside className="filters" aria-label="Filters">
          <div>
            <h3>Verdict</h3>
            <div className="chip-list">
              {Object.entries(VERDICTS).map(([k, v]) => (
                <button key={k} className={`chip${verdict === k ? " on" : ""}`} aria-pressed={verdict === k} onClick={() => update({ verdict: verdict === k ? "" : k })}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          {genres.data?.genres?.length > 0 && (
            <div>
              <h3>Genre</h3>
              <div className="chip-list">
                {genres.data.genres.map((g) => (
                  <button key={g.name} className={`chip${genre === g.name ? " on" : ""}`} aria-pressed={genre === g.name} onClick={() => update({ genre: genre === g.name ? "" : g.name })}>
                    {g.name} <span className="n">{g.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {filtering && (
            <button className="btn btn-sm" onClick={() => setParams({}, { replace: true })}>
              Clear all filters
            </button>
          )}
        </aside>

        <div>
          <div className="toolbar">
            <label htmlFor="explore-q" className="sr-only">
              Search
            </label>
            <input id="explore-q" type="search" className="input" placeholder="Search a title, author or genre" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label htmlFor="sort" className="sr-only">
              Sort by
            </label>
            <select id="sort" className="select" value={sort} onChange={(e) => update({ sort: e.target.value })}>
              {Object.entries(SORT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {list.data && (
            <p className="small muted" style={{ marginBottom: "1.25rem" }} aria-live="polite">
              {list.data.total} {list.data.total === 1 ? "summary" : "summaries"}
              {verdict && (
                <>
                  {" "}
                  marked <Stamp verdict={verdict} size="0.7rem" />
                </>
              )}
              {genre && <> in <strong style={{ textTransform: "capitalize" }}>{genre}</strong></>}
              {q && <> matching “{q}”</>}
            </p>
          )}

          {list.error ? (
            <ErrorState error={list.error} retry={list.refetch} />
          ) : list.isLoading ? (
            <BookGridSkeleton count={9} />
          ) : list.data.items.length === 0 ? (
            <Empty title="No summaries match" action={filtering && <button className="btn" onClick={() => setParams({}, { replace: true })}>Clear filters</button>}>
              Try a different spelling, or remove a filter.
            </Empty>
          ) : (
            <div style={{ opacity: list.isPlaceholderData ? 0.6 : 1 }}>
              <BookGrid books={list.data.items} />
              <Pagination page={list.data.page} pages={list.data.pages} onPage={(p) => update({ page: String(p) })} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
