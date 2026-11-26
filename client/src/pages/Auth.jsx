import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { useTitle } from "../lib/hooks.js";
import { Field } from "../components/ui.jsx";

function useNext() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  // Only allow same-site paths.
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function AuthForm({ fields, mutation, submitLabel, onSuccess }) {
  const [values, setValues] = useState(Object.fromEntries(fields.map((f) => [f.name, ""])));
  const err = mutation.error;
  const details = err?.details || {};
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(values, { onSuccess });
      }}
    >
      {err && <div className="form-error" role="alert">{err.message}</div>}
      {fields.map((f) => (
        <Field key={f.name} id={f.name} label={f.label} hint={f.hint} error={details[f.name]}>
          <input
            id={f.name}
            name={f.name}
            type={f.type || "text"}
            className="input"
            autoComplete={f.autoComplete}
            value={values[f.name]}
            aria-invalid={details[f.name] ? "true" : undefined}
            aria-describedby={details[f.name] ? `${f.name}-error` : undefined}
            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
            required
          />
        </Field>
      ))}
      <button className="btn btn-primary" disabled={mutation.isPending}>
        {mutation.isPending ? "One moment…" : submitLabel}
      </button>
    </form>
  );
}

export function Login() {
  useTitle("Log in");
  const { login } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  return (
    <div className="auth">
      <h1>Welcome back</h1>
      <p className="muted">Log in to rate, save and write summaries.</p>
      <AuthForm
        mutation={login}
        submitLabel="Log in"
        onSuccess={() => navigate(next, { replace: true })}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="muted small" style={{ marginTop: "1.5rem" }}>
        New here? <Link to={`/register${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</Link>
      </p>
    </div>
  );
}

export function Register() {
  useTitle("Sign up");
  const { register } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  return (
    <div className="auth">
      <h1>Create your account</h1>
      <p className="muted">Write summaries, suggest fixes and keep a library of what you've skipped.</p>
      <AuthForm
        mutation={register}
        submitLabel="Create account"
        onSuccess={() => navigate(next, { replace: true })}
        fields={[
          { name: "name", label: "Name", autoComplete: "name" },
          { name: "username", label: "Username", autoComplete: "username", hint: "3–24 letters, numbers or underscores. Shown on your profile." },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", hint: "At least 8 characters." },
        ]}
      />
      <p className="muted small" style={{ marginTop: "1.5rem" }}>
        Already have an account? <Link to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>Log in</Link>
      </p>
    </div>
  );
}
