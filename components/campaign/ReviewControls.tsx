"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Decision = "approve" | "changes" | "decline";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Who's reviewing, remembered in this browser so partners only type it once. */
function loadIdentity() {
  try {
    return { name: localStorage.getItem("fb-reviewer") ?? "", email: localStorage.getItem("fb-reviewer-email") ?? "" };
  } catch {
    return { name: "", email: "" };
  }
}
function saveIdentity(name: string, email: string) {
  try {
    localStorage.setItem("fb-reviewer", name);
    localStorage.setItem("fb-reviewer-email", email);
    window.dispatchEvent(new Event("fb-reviewer"));
  } catch {}
}

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [askIdentity, setAskIdentity] = useState<Decision>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // Every review card on the page shares the same identity; keep them in step.
  useEffect(() => {
    const sync = () => {
      const id = loadIdentity();
      setName(id.name);
      setEmail(id.email);
    };
    sync();
    window.addEventListener("fb-reviewer", sync);
    return () => window.removeEventListener("fb-reviewer", sync);
  }, []);

  const identified = name.trim().length > 1 && EMAIL.test(email.trim());

  async function send(decision: Decision) {
    if (decision !== "approve" && !comment.trim()) {
      setMode(decision);
      return;
    }
    if (!identified) {
      setAskIdentity(decision);
      return;
    }
    setBusy(true);
    setError(undefined);
    saveIdentity(name.trim(), email.trim());
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, recordId, decision, comment, reviewerName: name.trim(), reviewerEmail: email.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "That didn't save. Try again.");
      return;
    }
    setMode(undefined);
    setAskIdentity(undefined);
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

  if (askIdentity) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (identified) send(askIdentity);
        }}
        className="space-y-3 border-2 border-fb-black p-4"
      >
        <p className="text-sm font-bold">Before you {askIdentity === "approve" ? "approve" : "send feedback"}, who&apos;s reviewing?</p>
        <p className="text-xs">So the team knows who signed off. We&apos;ll remember you on this device.</p>
        <label className="block">
          <span className="text-xs font-bold">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            autoComplete="name"
            className="mt-1 w-full border-b-2 border-fb-black bg-transparent py-1 text-sm outline-none focus:border-fb-red"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold">Work email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full border-b-2 border-fb-black bg-transparent py-1 text-sm outline-none focus:border-fb-red"
          />
        </label>
        <div className="flex gap-2">
          <button
            disabled={!identified || busy}
            className="subtitle bg-fb-red text-fb-white px-4 py-2.5 text-xs hover:bg-fb-black transition-colors disabled:opacity-50"
          >
            {busy ? "Saving" : askIdentity === "approve" ? "Approve" : "Send feedback"}
          </button>
          <button type="button" onClick={() => setAskIdentity(undefined)} className="px-3 py-2.5 text-xs underline underline-offset-4">
            Cancel
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm font-bold text-fb-red">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="space-y-3">
      {identified && (
        <p className="text-xs">
          Reviewing as {name} ({email}) ·{" "}
          <button
            type="button"
            onClick={() => {
              saveIdentity("", "");
            }}
            className="underline underline-offset-2"
          >
            not you?
          </button>
        </p>
      )}
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
