"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Team only: set who made a post and when it went up, when the automatic match is wrong or missing. */
export function PostEditor({
  campaignId,
  postId,
  creatorId,
  postedAt,
  creators,
}: {
  campaignId: string;
  postId: string;
  creatorId?: string;
  postedAt?: string;
  creators: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creator, setCreator] = useState(creatorId ?? "");
  const [date, setDate] = useState(postedAt?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save() {
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaignId}/posts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, creatorId: creator || null, postedAt: date || null }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "That didn't save. Try again.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-quiet btn-sm mt-2 self-start">
        Edit post
      </button>
    );
  }

  const field = "field";
  return (
    <div className="mt-3 space-y-3 rounded-control border border-line bg-wash-neutral p-3 text-sm">
      <label className="block">
        <span className="field-label">Creator</span>
        <select value={creator} onChange={(e) => setCreator(e.target.value)} className={field}>
          <option value="">Not set</option>
          {creators.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="field-label">Posted on</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <p className="text-xs text-muted">A creator who isn&apos;t on this campaign yet is added to it as approved.</p>
      {error && <p className="text-sm font-bold text-fb-red">{error}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet btn-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
