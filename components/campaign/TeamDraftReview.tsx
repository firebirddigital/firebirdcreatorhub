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
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-secondary underline underline-offset-4 hover:text-fb-red transition-colors">
        Change decision
      </button>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <label className="block">
        <span className="field-label">On behalf of (optional)</span>
        <input
          value={onBehalfOf}
          onChange={(e) => setOnBehalfOf(e.target.value)}
          placeholder="e.g. Jane at the label"
          className="field"
        />
      </label>
      {mode === "changes" && (
        <label className="block">
          <span className="field-label">What should change? (the creator sees this)</span>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            autoFocus
            className="field"
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
              className="btn btn-primary btn-sm"
            >
              {busy ? "Saving…" : "Send changes"}
            </button>
            <button type="button" onClick={() => setMode(undefined)} className="btn btn-quiet btn-sm">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => send("approve")}
              className="btn btn-primary btn-sm"
            >
              {busy ? "Saving…" : "Approve"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setMode("changes")}
              className="btn btn-sm"
            >
              Request changes
            </button>
          </>
        )}
      </div>
      {error && <p className="text-sm font-bold text-fb-red">{error}</p>}
    </div>
  );
}
