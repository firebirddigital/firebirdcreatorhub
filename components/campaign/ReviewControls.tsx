"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Decision = "approve" | "changes" | "decline";

/** Approve / request changes buttons on the partner share link. */
export function ReviewControls({
  endpoint,
  kind,
  recordId,
  allowDecline = false,
  decided,
}: {
  endpoint: string;
  kind: "creator" | "draft";
  recordId: string;
  allowDecline?: boolean;
  /** Already reviewed: show a quieter "change decision" toggle instead of the buttons */
  decided?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!decided);
  const [mode, setMode] = useState<Decision>();
  const [comment, setComment] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    try {
      setReviewer(localStorage.getItem("fb-reviewer") ?? "");
    } catch {}
  }, []);

  async function send(decision: Decision) {
    if (decision !== "approve" && !comment.trim()) {
      setMode(decision);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      localStorage.setItem("fb-reviewer", reviewer);
    } catch {}
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, recordId, decision, comment, reviewer }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "That didn't save. Try again.");
      return;
    }
    setMode(undefined);
    setComment("");
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm underline underline-offset-4 hover:text-fb-red">
        Change decision
      </button>
    );
  }

  const noun = kind === "creator" ? "creator" : "draft";

  return (
    <div className="space-y-3">
      {mode && (
        <div className="space-y-2">
          <label className="block">
            <span className="text-sm font-bold">
              {mode === "decline" ? `Why pass on this ${noun}?` : "What should change?"}
            </span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              autoFocus
              className="mt-1 w-full border-2 border-fb-black p-2 text-sm outline-none focus:border-fb-red"
            />
          </label>
          <label className="block">
            <span className="text-xs">Your name (optional)</span>
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              className="mt-1 w-full border-b-2 border-fb-black bg-transparent py-1 text-sm outline-none focus:border-fb-red"
            />
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!mode && (
          <button
            onClick={() => send("approve")}
            disabled={busy}
            className="subtitle bg-fb-red text-fb-white px-4 py-2.5 text-xs hover:bg-fb-black transition-colors disabled:opacity-50"
          >
            {busy ? "Saving" : "Approve"}
          </button>
        )}
        {mode ? (
          <>
            <button
              onClick={() => send(mode)}
              disabled={busy || !comment.trim()}
              className="subtitle bg-fb-black text-fb-white px-4 py-2.5 text-xs hover:bg-fb-red transition-colors disabled:opacity-50"
            >
              {busy ? "Sending" : mode === "decline" ? "Pass on creator" : "Send feedback"}
            </button>
            <button onClick={() => setMode(undefined)} className="px-3 py-2.5 text-xs underline underline-offset-4">
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setMode("changes")}
              disabled={busy}
              className="subtitle border-2 border-fb-black px-4 py-2 text-xs hover:bg-fb-black hover:text-fb-white transition-colors"
            >
              Request changes
            </button>
            {allowDecline && (
              <button onClick={() => setMode("decline")} disabled={busy} className="px-2 py-2 text-xs underline underline-offset-4">
                Pass
              </button>
            )}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
    </div>
  );
}
