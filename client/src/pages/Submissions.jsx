import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { timeAgo, useTitle } from "../lib/hooks.js";
import { BookRow } from "../components/Book.jsx";
import { Empty, ErrorState, Spinner } from "../components/ui.jsx";

const STATUS_TEXT = { pending: "Waiting for review", published: "Live", rejected: "Sent back", approved: "Published" };

export default function Submissions() {
  useTitle("Your submissions");
  const { data, isLoading, error } = useQuery({ queryKey: ["submissions"], queryFn: () => api.get("/me/submissions") });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <div className="page-head">
        <h1>Your submissions</h1>
        <p>Track the summaries you've written and the edits you've suggested.</p>
      </div>

      <section>
        <div className="section-head">
          <h2 style={{ fontSize: "var(--t-xl)" }}>Summaries you wrote</h2>
          <Link to="/write">Write a new one</Link>
        </div>
        {data.books.length === 0 ? (
          <Empty title="You haven't written a summary yet" action={<Link to="/write" className="btn btn-primary">Write a summary</Link>}>
            Read a novel others could skip? Share the gist.
          </Empty>
        ) : (
          <div className="panel" style={{ padding: "0.25rem 1.25rem" }}>
            {data.books.map((b) => (
              <BookRow key={b.id} book={b}>
                {b.status === "rejected" && b.rejectionReason && <span className="small muted" style={{ maxWidth: 280 }}>“{b.rejectionReason}”</span>}
                <span className={`pill ${b.status}`}>{STATUS_TEXT[b.status]}</span>
                {b.status !== "published" && (
                  <Link className="btn btn-sm" to={`/books/${b.slug}/edit`}>
                    {b.status === "rejected" ? "Fix and resend" : "Edit"}
                  </Link>
                )}
              </BookRow>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 style={{ fontSize: "var(--t-xl)" }}>Edits you suggested</h2>
        </div>
        {data.editRequests.length === 0 ? (
          <p className="muted">When you suggest a fix to a live summary, you can follow it here.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Summary</th>
                  <th>Changed</th>
                  <th>Sent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.editRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.book ? <Link to={`/books/${r.book.slug}`}>{r.book.title}</Link> : <em className="faint">Removed</em>}</td>
                    <td>{r.fields.length} field{r.fields.length === 1 ? "" : "s"}</td>
                    <td>{timeAgo(r.createdAt)}</td>
                    <td>
                      <span className={`pill ${r.status}`}>{STATUS_TEXT[r.status]}</span>
                      {r.reviewNote && <div className="small muted" style={{ marginTop: 4 }}>“{r.reviewNote}”</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
