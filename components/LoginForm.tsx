"use client";

import { useState } from "react";

export function LoginForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.href = next;
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Sign-in failed. Try again.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="text-left">
      <label className="block">
        <span className="signin-label">Team password</span>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="signin-input"
        />
      </label>
      {/* Always rendered: .signin-error keeps its height so the button doesn't jump when a message appears. */}
      <p role="alert" className="signin-error">
        {error}
      </p>
      <button disabled={busy} className="signin-submit">
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
