import { useState } from "react";
import { Link } from "react-router-dom";
import { VERDICTS } from "../lib/hooks.js";
import { IconChat, IconClock, IconHeart, IconStar } from "./Icons.jsx";

/** Stable number from a string, used to give each book its own cover colour. */
function hash(str = "") {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Stable hue for a string. Skips the muddy yellow-greens. */
export function hashHue(str = "") {
  const hues = [8, 22, 196, 212, 228, 248, 266, 284, 320, 340, 160, 178];
  return hues[hash(str) % hues.length];
}

export function Stamp({ verdict = "skip", tilted, size }) {
  const v = VERDICTS[verdict] ?? VERDICTS.skip;
  return (
    <span className={`stamp stamp-${verdict}${tilted ? " tilted" : ""}`} style={size ? { "--stamp-size": size } : undefined}>
      {v.label}
    </span>
  );
}

export function Cover({ book, small, showStamp = true }) {
  const [broken, setBroken] = useState(false);
  const seed = book.title + (book.author || "");
  const hue = hashHue(seed);
  const variant = hash(seed + "#") % 4;
  const pattern = ["p-stripes", "p-dots", "p-band", "p-arc"][variant];
  const lit = [24, 30, 36, 28][hash(seed + "!") % 4];
  const hasImage = book.coverUrl && !broken;
  const len = book.title?.length || 0;
  const size = small ? undefined : len > 40 ? "0.95rem" : len > 22 ? "1.05rem" : undefined;
  return (
    <div
      className={`cover ${pattern}${small ? " cover-sm" : ""}${hasImage ? " has-image" : ""}`}
      style={{ "--hue": hue, "--lit": `${lit}%`, "--angle": `${(hue % 4) * 45}deg`, ...(size ? { "--cover-size": size } : {}) }}
    >
      {hasImage ? (
        <img src={book.coverUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <>
          <div className="cover-pattern" />
          <div className="cover-title">{book.title}</div>
          {book.author && <div className="cover-author">{book.author}</div>}
        </>
      )}
      {showStamp && book.verdict && <Stamp verdict={book.verdict} />}
    </div>
  );
}

export function BookStats({ book }) {
  return (
    <div className="stats-line">
      <span title="Summary reading time">
        <IconClock /> {book.readingTime} min
      </span>
      {book.ratingCount > 0 && (
        <span title={`${book.ratingCount} rating${book.ratingCount === 1 ? "" : "s"}`}>
          <IconStar /> {book.ratingAvg.toFixed(1)}
        </span>
      )}
      {book.likesCount > 0 && (
        <span title="Likes">
          <IconHeart /> {book.likesCount}
        </span>
      )}
      {book.commentsCount > 0 && (
        <span title="Comments">
          <IconChat /> {book.commentsCount}
        </span>
      )}
    </div>
  );
}

export function BookTile({ book }) {
  return (
    <Link to={`/books/${book.slug}`} className="book-tile">
      <Cover book={book} />
      <div>
        <h3>{book.title}</h3>
        {book.author && <div className="meta">{book.author}</div>}
      </div>
      <BookStats book={book} />
    </Link>
  );
}

export function BookGrid({ books }) {
  return (
    <div className="book-grid">
      {books.map((b) => (
        <BookTile key={b.id} book={b} />
      ))}
    </div>
  );
}

export function BookGridSkeleton({ count = 8 }) {
  return (
    <div className="book-grid" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="book-tile">
          <div className="skeleton" style={{ aspectRatio: "2/3" }} />
          <div className="skeleton" style={{ height: 18, width: "80%" }} />
          <div className="skeleton" style={{ height: 14, width: "50%" }} />
        </div>
      ))}
    </div>
  );
}

export function BookRow({ book, children }) {
  return (
    <div className="book-row">
      <Cover book={book} small showStamp={false} />
      <div>
        <h3>
          <Link to={`/books/${book.slug}`}>{book.title}</Link>
        </h3>
        <div className="small muted">{book.author || "Unknown author"}</div>
      </div>
      <div className="row">{children}</div>
    </div>
  );
}
