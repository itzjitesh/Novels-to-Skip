import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../lib/auth.jsx";
import { useToast } from "../lib/toast.jsx";
import { useTitle } from "../lib/hooks.js";
import { Avatar, Field } from "../components/ui.jsx";

export default function Settings() {
  useTitle("Settings");
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [profile, setProfile] = useState({ name: user.name, bio: user.bio || "", avatarUrl: user.avatarUrl || "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });

  const saveProfile = useMutation({
    mutationFn: () => api.patch("/me", profile),
    onSuccess: (r) => {
      qc.setQueryData(["me"], r.user);
      qc.invalidateQueries({ queryKey: ["profile", user.username] });
      toast("Profile saved");
    },
  });
  const savePw = useMutation({
    mutationFn: () => api.patch("/me/password", pw),
    onSuccess: () => {
      setPw({ currentPassword: "", newPassword: "" });
      toast("Password changed");
    },
  });
  const pe = saveProfile.error?.details || {};
  const we = savePw.error?.details || {};

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Signed in as {user.email}.</p>
      </div>

      <form
        className="form-section"
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate();
        }}
      >
        <h2>Profile</h2>
        {saveProfile.error && <div className="form-error">{saveProfile.error.message}</div>}
        <div className="row">
          <Avatar user={{ ...user, ...profile }} size="lg" />
          <span className="small muted">Your avatar uses your initials unless you add an image link below.</span>
        </div>
        <Field id="name" label="Name" error={pe.name}>
          <input id="name" className="input" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} maxLength={60} />
        </Field>
        <Field id="bio" label="Bio" hint={`${280 - profile.bio.length} characters left`} error={pe.bio}>
          <textarea id="bio" className="textarea" rows={3} maxLength={280} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} />
        </Field>
        <Field id="avatarUrl" label="Avatar image link (optional)" error={pe.avatarUrl}>
          <input id="avatarUrl" className="input" type="url" placeholder="https://…" value={profile.avatarUrl} onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })} />
        </Field>
        <div>
          <button className="btn btn-primary" disabled={saveProfile.isPending}>
            Save profile
          </button>
        </div>
      </form>

      <form
        className="form-section"
        onSubmit={(e) => {
          e.preventDefault();
          savePw.mutate();
        }}
      >
        <h2>Change password</h2>
        {savePw.error && <div className="form-error">{savePw.error.message}</div>}
        <Field id="currentPassword" label="Current password" error={we.currentPassword}>
          <input id="currentPassword" type="password" className="input" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
        </Field>
        <Field id="newPassword" label="New password" hint="At least 8 characters." error={we.newPassword}>
          <input id="newPassword" type="password" className="input" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
        </Field>
        <div>
          <button className="btn btn-primary" disabled={savePw.isPending || !pw.currentPassword || !pw.newPassword}>
            Change password
          </button>
        </div>
      </form>
    </div>
  );
}
