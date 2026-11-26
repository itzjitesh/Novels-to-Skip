import { useEffect, useState } from "react";

const SITE = "Novels to Skip";

export function useTitle(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} — read the summary, skip the book`;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", description);
    }
  }, [title, description]);
}

export function useTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("nts-theme", theme);
    } catch {
      /* storage unavailable */
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "dark" ? "light" : "dark"))];
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const VERDICTS = {
  skip: { label: "Skip it", short: "Skip", help: "The summary gives you everything you need." },
  skim: { label: "Skim it", short: "Skim", help: "Read the summary, then dip into the best parts." },
  read: { label: "Read it", short: "Read", help: "Worth reading in full — the summary can't replace it." },
};

export const SHELVES = {
  want: "Want to read",
  reading: "Reading",
  finished: "Finished",
  skipped: "Skipped",
};

export function timeAgo(date) {
  if (!date) return "";
  const s = (Date.now() - new Date(date).getTime()) / 1000;
  if (s < 60) return "just now";
  const units = [
    [60, "minute"],
    [3600, "hour"],
    [86400, "day"],
    [604800, "week"],
    [2629800, "month"],
    [31557600, "year"],
  ];
  let unit = units[0];
  for (const u of units) if (s >= u[0]) unit = u;
  const n = Math.floor(s / unit[0]);
  return `${n} ${unit[1]}${n === 1 ? "" : "s"} ago`;
}

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
