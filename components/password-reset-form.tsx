"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function PasswordResetForm() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password.length < 10 || password.length > 128) {
      setError("Choose a password between 10 and 128 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setBusy(true);
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setBusy(false);
      setError("This recovery link has expired or was already used. Request a new one.");
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (authError) {
      setError("We could not update your password. Request a fresh recovery link and try again.");
      return;
    }
    setComplete(true);
  }

  if (complete) return <div className="auth-reset-complete"><p className="form-success" role="status">Your password has been changed. You’re signed in.</p><Link className="button button-dark auth-submit" href="/community">Continue to the community <span aria-hidden="true"></span></Link></div>;

  return <form className="auth-form" onSubmit={updatePassword}>
    <label htmlFor="reset-password">New password <span>10 characters minimum</span></label>
    <input id="reset-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required />
    <label htmlFor="confirm-reset-password">Confirm new password</label>
    <input id="confirm-reset-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
    {error && <p className="form-alert" role="alert">{error}</p>}
    <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy ? "Saving password…" : "Set new password"} <span aria-hidden="true"></span></button>
  </form>;
}
