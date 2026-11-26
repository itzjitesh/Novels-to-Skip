import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { formatDate, useTitle } from "../lib/hooks.js";
import { BookGrid } from "../components/Book.jsx";
import { Avatar, Empty, ErrorState, Spinner } from "../components/ui.jsx";

export default function Profile() {
  const { username } = useParams();
  const { user: me } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ["profile", username], queryFn: () => api.get(`/users/${username}`) });
  useTitle(data ? `${data.user.name} (@${data.user.username})` : "Profile");
  if (isLoading) return <Spinner />;
  if (error) return <ErrorState error={error} />;
  const { user, books, stats } = data;
  const isMe = me?.username === user.username;

  return (
    <>
      <div className="profile-head">
        <Avatar user={user} size="lg" />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "var(--t-2xl)" }}>{user.name}</h1>
          <div className="muted">
            @{user.username} {user.role === "admin" && <span className="pill admin">Admin</span>}
          </div>
          {user.bio && <p className="bio">{user.bio}</p>}
          <div className="hero-facts" style={{ marginTop: "1rem" }}>
            <div>
              <strong>{stats.summaries}</strong> summaries
            </div>
            <div>
              <strong>{stats.likes}</strong> likes received
            </div>
            {stats.hoursSaved > 0 && (
              <div>
                <strong>{stats.hoursSaved}</strong> hours saved for readers
              </div>
            )}
          </div>
        </div>
        {isMe && (
          <Link to="/me/settings" className="btn">
            Edit profile
          </Link>
        )}
      </div>
      <div className="section-head">
        <h2 style={{ fontSize: "var(--t-xl)" }}>Summaries</h2>
        <span className="small faint">Member since {formatDate(user.createdAt)}</span>
      </div>
      {books.length ? (
        <BookGrid books={books} />
      ) : (
        <Empty title="No published summaries yet" action={isMe && <Link className="btn btn-primary" to="/write">Write your first</Link>} />
      )}
    </>
  );
}
