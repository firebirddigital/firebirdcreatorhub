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
    <form onSubmit={submit} className="mt-10 space-y-4">
      <label className="block">
        <span className="text-sm">Team password</span>
        <input
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-2 w-full bg-transparent border-b-2 border-fb-white py-3 text-lg outline-none focus:border-fb-red"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-fb-red">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        className="subtitle bg-fb-red text-fb-white px-8 py-4 text-sm hover:bg-fb-white hover:text-fb-black transition-colors disabled:opacity-60"
      >
        {busy ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
