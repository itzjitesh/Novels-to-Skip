import { Link } from "react-router-dom";
import { useTitle } from "../lib/hooks.js";
import { Empty } from "../components/ui.jsx";
import { Stamp } from "../components/Book.jsx";

export default function NotFound() {
  useTitle("Page not found");
  return (
    <div style={{ maxWidth: 520, margin: "2rem auto" }}>
      <Empty title="This page doesn't exist" action={<Link to="/books" className="btn btn-primary">Browse summaries</Link>}>
        The link may be old, or the summary was removed.
      </Empty>
      <div style={{ textAlign: "center", marginTop: "-1.2rem" }}>
        <Stamp verdict="skip" tilted />
      </div>
    </div>
  );
}
