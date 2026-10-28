"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const KEY = "fb-team-on-behalf";

/**
 * Team-side Approve / Request changes on a draft, for when a partner gives the decision another way.
 * "On behalf of" is optional and remembered in this browser.
 */
export function TeamDraftReview({ campaignId, draftId, decided }: { campaignId: string; draftId: string; decided: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!decided);
  const [mode, setMode] = useState<"approve" | "changes">();
  const [comment, setComment] = useState("");
  const [onBehalfOf, setOnBehalfOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    try {
      setOnBehalfOf(localStorage.getItem(KEY) ?? "");
    } catch {}
  }, []);

  async function send(decision: "approve" | "changes") {
    if (decision === "changes" && !comment.trim()) return setError("Add a note so the creator knows what to change.");
    setBusy(true);
    setError(undefined);
    try {
      localStorage.setItem(KEY, onBehalfOf.trim());
    } catch {}
    const res = await fetch(`/api/campaigns/${campaignId}/drafts`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, decision, comment: comment.trim() || undefined, onBehalfOf: onBehalfOf.trim() || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "That didn't save. Try again.");
    setMode(undefined);
    setComment("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline underline-offset-4 hover:text-fb-red">
        Change decision
      </button>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="text-xs font-bold">On behalf of (optional)</span>
        <input
          value={onBehalfOf}
          onChange={(e) => setOnBehalfOf(e.target.value)}
          placeholder="e.g. Jane at the label"
          className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 outline-none focus:border-fb-red"
        />
      </label>
      {mode === "changes" && (
        <label className="block">
          <span className="text-xs font-bold">What should change? (the creator sees this)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            autoFocus
            className="mt-1 block w-full border-2 border-fb-black bg-transparent p-2 outline-none focus:border-fb-red"
          />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        {mode === "changes" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("changes")}
              className="subtitle border-2 border-fb-black bg-fb-black text-fb-white px-4 py-2 text-xs disabled:opacity-50"
            >
              {busy ? "Saving…" : "Send changes"}
            </button>
            <button type="button" onClick={() => setMode(undefined)} className="text-sm underline underline-offset-4">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("approve")}
              className="subtitle border-2 border-fb-red bg-fb-red text-fb-white px-4 py-2 text-xs hover:bg-fb-black hover:border-fb-black disabled:opacity-50"
            >
              {busy ? "Saving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("changes")}
              className="subtitle border-2 border-fb-black px-4 py-2 text-xs hover:bg-fb-black hover:text-fb-white disabled:opacity-50"
            >
              Request changes
            </button>
          </>
        )}
      </div>
      {error && <p className="font-bold text-fb-red">{error}</p>}
    </div>
  );
}
