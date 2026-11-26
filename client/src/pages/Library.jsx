import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { SHELVES, useTitle } from "../lib/hooks.js";
import { BookGrid } from "../components/Book.jsx";
import { Empty, ErrorState, Spinner } from "../components/ui.jsx";

export default function Library() {
  useTitle("Your library");
  const [tab, setTab] = useState("saved");
  const { data, isLoading, error } = useQuery({ queryKey: ["library"], queryFn: () => api.get("/me/library") });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} />;

  const tabs = [["saved", "Saved summaries", data.bookmarks.length], ...Object.entries(SHELVES).map(([k, l]) => [k, l, data.shelves.filter((s) => s.shelf === k).length])];
  const books = tab === "saved" ? data.bookmarks : data.shelves.filter((s) => s.shelf === tab).map((s) => s.book);

  return (
    <>
      <div className="page-head">
        <h1>Your library</h1>
        <p>Summaries you've saved, and books you've put on a shelf.</p>
      </div>
      <div className="tabs" role="tablist">
        {tabs.map(([k, l, n]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {l} <span className="faint">{n}</span>
          </button>
        ))}
      </div>
      {books.length ? (
        <BookGrid books={books} />
      ) : (
        <Empty title="Nothing here yet" action={<Link to="/books" className="btn btn-primary">Browse summaries</Link>}>
          {tab === "saved" ? "Use Save on any summary to keep it here." : "Pick a shelf on any summary page to add the book here."}
        </Empty>
      )}
    </>
  );
}
