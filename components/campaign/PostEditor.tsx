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
      <button type="button" onClick={() => setOpen(true)} className="mt-2 text-xs underline underline-offset-2 hover:text-fb-red">
        Edit post
      </button>
    );
  }

  const field = "mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 font-bold outline-none focus:border-fb-red";
  return (
    <div className="mt-3 space-y-3 border-2 border-fb-black p-3 text-sm">
      <label className="block">
        <span className="text-xs font-bold">Creator</span>
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
        <span className="text-xs font-bold">Posted on</span>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <p className="text-xs">A creator who isn&apos;t on this campaign yet is added to it as approved.</p>
      {error && <p className="font-bold text-fb-red">{error}</p>}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="subtitle border-2 border-fb-red bg-fb-red text-fb-white px-4 py-2 text-xs hover:bg-fb-black hover:border-fb-black disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="underline underline-offset-4">
          Cancel
        </button>
      </div>
    </div>
  );
}
