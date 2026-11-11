"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Creator } from "@/lib/types";

const input = "field font-bold placeholder:font-normal placeholder:text-muted";

const num = (n?: number) => (n ? String(n) : "");
const toNum = (s: string) => (s.trim() ? Number(s.replace(/[^\d]/g, "")) : null);

/**
 * A creator's editable details: handles, followers, median views, rate, location, email, tags and notes.
 * Saves to the Creators table, so the change shows on every campaign and on the creators page.
 */
export function CreatorForm({
  creator: c,
  note,
  disabled,
  onSaved,
  onCancel,
}: {
  creator: Creator;
  note?: string;
  /** Sample data: show the form but don't save. */
  disabled?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
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
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setF((prev) => ({ ...prev, [k]: e.target.value }));
  };

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
    }).catch(() => undefined);
    setBusy(false);
    if (!res?.ok) {
      setError(((await res?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? "That didn't save. Try again.");
      return;
    }
    setSaved(true);
    router.refresh();
    onSaved();
  }

  const field = (k: keyof typeof f, label: string, opts: { numeric?: boolean; placeholder?: string; wide?: boolean; type?: string } = {}) => (
    <label className={`block text-sm ${opts.wide ? "col-span-2" : "max-sm:col-span-2"}`}>
      <span className="field-label">{label}</span>
      <input
        type={opts.type}
        value={f[k]}
        onChange={set(k)}
        inputMode={opts.numeric ? "numeric" : undefined}
        placeholder={opts.placeholder}
        className={input}
      />
    </label>
  );

  return (
    <form onSubmit={save} className="space-y-3">
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {field("name", "Name", { wide: true })}
        {field("tiktok", "TikTok handle", { placeholder: "@handle" })}
        {field("tiktokFollowers", "TikTok followers", { numeric: true })}
        {field("instagram", "Instagram handle", { placeholder: "@handle" })}
        {field("instagramFollowers", "Instagram followers", { numeric: true })}
        {field("avgViews", "Median views (last 10)", { numeric: true })}
        {field("rate", "Rate per post ($)", { numeric: true })}
        {field("email", "Email", { type: "email" })}
        {field("location", "Location")}
        {field("tags", "Tags", { wide: true, placeholder: "Comma separated" })}
        <label className="block text-sm col-span-2">
          <span className="field-label">Notes (team only)</span>
          <textarea value={f.notes} onChange={set("notes")} rows={4} className="field" />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-fb-red font-bold">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy || disabled}
          title={disabled ? "Connect Airtable to edit creators" : undefined}
          className="btn btn-primary btn-sm"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-quiet btn-sm">
            Cancel
          </button>
        )}
        {saved && <span className="text-xs font-bold text-secondary">Saved</span>}
      </div>
    </form>
  );
}

/** "Edit details" for a creator on a campaign. The campaign fee is separate (Fee box). */
export function CreatorEditButton({ creator }: { creator: Creator }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline underline-offset-4 hover:text-fb-red">
        Edit details
      </button>
    );
  }
  return (
    <div className="rounded-card border border-line bg-wash-neutral p-4">
      <CreatorForm
        creator={creator}
        note="Updates this creator everywhere in the hub. The campaign fee is set in the Fee box."
        onSaved={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
