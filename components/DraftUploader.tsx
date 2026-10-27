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
        handleUploadUrl: `/api/submit/${aid}/${sig}/upload`,
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
    <form onSubmit={submit} className="border-2 border-fb-black p-6 max-sm:p-4 space-y-5">
      <h2 className="headline text-3xl">{nextVersion === 1 ? "Your draft" : `Version ${nextVersion}`}</h2>

      <DraftSourceInput value={choice} onChange={setChoice} disabled={busy} audience="creator" />

      <label className="block">
        <span className="text-sm font-bold">Caption you plan to post</span>
        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={busy}
          className="mt-2 w-full border-2 border-fb-black p-2 outline-none focus:border-fb-red disabled:opacity-50"
        />
      </label>

      <UploadProgress progress={progress} />

      {disabled && <p className="text-sm">{disabledReason}</p>}
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}

      <button
        disabled={busy || !choiceReady(choice)}
        className="subtitle bg-fb-red text-fb-white px-8 py-4 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
      >
        {progress !== undefined ? "Uploading" : saving ? "Sending" : "Send draft"}
      </button>
    </form>
  );
}
