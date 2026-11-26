import { Link } from "react-router-dom";
import { useTitle, VERDICTS } from "../lib/hooks.js";
import { Stamp } from "../components/Book.jsx";

export default function About() {
  useTitle("How it works");
  return (
    <div className="about">
      <h1>How Novels to Skip works</h1>
      <div className="reading">
        <p>
          Some novels change your life. Many others take twenty hours to say what a good summary says in five minutes. This site helps you tell
          them apart.
        </p>
        <p>
          Every summary has the same shape: what the book is really about, the key points, the story without spoilers, and the ending tucked behind a
          button for when you want it. Then a verdict.
        </p>
      </div>

      <section className="reading-section">
        <h2>The verdicts</h2>
        <div className="stack" style={{ "--gap": "1.25rem" }}>
          {Object.entries(VERDICTS).map(([k, v]) => (
            <div key={k} className="row" style={{ alignItems: "flex-start", gap: "1.25rem" }}>
              <div style={{ width: 96 }}>
                <Stamp verdict={k} tilted />
              </div>
              <p style={{ flex: 1 }}>{v.help}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="reading-section">
        <h2>Who writes the summaries</h2>
        <div className="reading">
          <p>
            Anyone with an account can write one. New summaries are checked by an admin before they go live, so the site stays accurate and free of
            spam.
          </p>
          <p>
            Spotted a mistake in a live summary? Use <strong>Suggest an edit</strong> on its page. An admin reviews the change side by side with the
            original and publishes it if it's right. You can follow the status of everything you've sent in <Link to="/me/submissions">your submissions</Link>.
          </p>
        </div>
      </section>

      <section className="reading-section">
        <h2>Who's behind it</h2>
        <div className="reading">
          <p>
            Novels to Skip is built and run by Jitesh Singh, a web developer in New Delhi. Say hello at{" "}
            <a href="mailto:singhjitesh469@gmail.com">singhjitesh469@gmail.com</a>, or find me on{" "}
            <a href="https://github.com/itzjitesh" target="_blank" rel="noreferrer">GitHub</a> and{" "}
            <a href="https://www.linkedin.com/in/singhjitesh/" target="_blank" rel="noreferrer">LinkedIn</a>.
          </p>
        </div>
      </section>
    </div>
  );
}
