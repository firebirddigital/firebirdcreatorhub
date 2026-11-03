"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Creator } from "@/lib/types";

const input = "field font-bold placeholder:font-normal placeholder:text-muted";

const num = (n?: number) => (n ? String(n) : "");
const toNum = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, "")) : null);

/**
 * "Edit details" for a creator on a campaign. Saves to the Creators table, so the change shows on
 * every campaign and on the creators page. The campaign fee is separate (Fee box).
 */
export function CreatorEditButton({ creator: c }: { creator: Creator }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [f, setF] = useState(() => ({
    name: c.name,
    tiktok: c.tiktok ?? "",
    tiktokFollowers: num(c.tiktokFollowers),
    instagram: c.instagram ?? "",
    instagramFollowers: num(c.instagramFollowers),
    avgViews: num(c.avgViews),
    rate: num(c.rate),
    location: c.location ?? "",
    email: c.email ?? "",
    tags: c.tags.join(", "),
    notes: c.notes ?? "",
  }));
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/creators/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name,
        tiktok: f.tiktok,
        tiktokFollowers: toNum(f.tiktokFollowers),
        instagram: f.instagram,
        instagramFollowers: toNum(f.instagramFollowers),
        avgViews: toNum(f.avgViews),
        rate: toNum(f.rate),
        location: f.location,
        email: f.email,
        tags: f.tags.split(","),
        notes: f.notes,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save. Try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline underline-offset-4 hover:text-fb-red">
        Edit details
      </button>
    );
  }

  const field = (k: keyof typeof f, label: string, opts: { numeric?: boolean; placeholder?: string; wide?: boolean } = {}) => (
    <label className={`block text-sm ${opts.wide ? "col-span-2" : ""}`}>
      <span className="field-label">{label}</span>
      <input
        value={f[k]}
        onChange={set(k)}
        inputMode={opts.numeric ? "numeric" : undefined}
        placeholder={opts.placeholder}
        className={input}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="rounded-card border border-line bg-wash-neutral p-4 space-y-3">
      <p className="text-xs text-muted">Updates this creator everywhere in the hub. The campaign fee is set in the Fee box.</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {field("name", "Name", { wide: true })}
        {field("tiktok", "TikTok handle", { placeholder: "@handle" })}
        {field("tiktokFollowers", "TikTok followers", { numeric: true })}
        {field("instagram", "Instagram handle", { placeholder: "@handle" })}
        {field("instagramFollowers", "Instagram followers", { numeric: true })}
        {field("avgViews", "Median views (last 10)", { numeric: true })}
        {field("rate", "Rate ($)", { numeric: true })}
        {field("location", "Location", { wide: true })}
        {field("email", "Email", { wide: true })}
        {field("tags", "Tags", { wide: true, placeholder: "Comma separated" })}
        <label className="block text-sm col-span-2">
          <span className="field-label">Notes (team only)</span>
          <textarea value={f.notes} onChange={set("notes")} rows={3} className="field" />
        </label>
      </div>
      {error && <p className="text-sm text-fb-red font-bold">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet btn-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}
