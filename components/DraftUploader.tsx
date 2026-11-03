"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { choiceReady, DraftSourceInput, emptyChoice, resolveDraft, UploadProgress } from "./DraftSourceInput";

export function DraftUploader({
  aid,
  sig,
  nextVersion,
  disabled,
  disabledReason,
}: {
  aid: string;
  sig: string;
  nextVersion: number;
  disabled: boolean;
  disabledReason: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(emptyChoice);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!choiceReady(choice)) return;
    setError(undefined);
    setSaving(true);
    try {
      if (choice.mode === "file") setProgress(0);
      const videoUrl = await resolveDraft(choice, {
        path: `drafts/${aid}/v${nextVersion}`,
        uploadUrl: `/api/submit/${aid}/${sig}/upload`,
        onProgress: setProgress,
      });
      const res = await fetch(`/api/submit/${aid}/${sig}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl, caption }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Saving the draft failed.");
      setChoice(emptyChoice());
      setCaption("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sending failed. Check your connection and try again.");
    } finally {
      setProgress(undefined);
      setSaving(false);
    }
  }

  const busy = saving || disabled;

  return (
    <form onSubmit={submit} className="card space-y-5">
      <h2>{nextVersion === 1 ? "Your draft" : `Version ${nextVersion}`}</h2>

      <DraftSourceInput value={choice} onChange={setChoice} disabled={busy} audience="creator" />

      <label className="block">
        <span className="field-label">Caption you plan to post</span>
        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={busy}
          className="field"
        />
      </label>

      <UploadProgress progress={progress} />

      {disabled && <p className="text-sm text-secondary">{disabledReason}</p>}
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}

      <button disabled={busy || !choiceReady(choice)} className="btn btn-primary">
        {progress !== undefined ? "Uploading" : saving ? "Sending" : "Send draft"}
      </button>
    </form>
  );
}
