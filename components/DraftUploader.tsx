"use client";

import { upload } from "@vercel/blob/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MAX_MB = 500;

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
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number>();
  const [error, setError] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That file is over ${MAX_MB}MB. Export a smaller version and try again.`);
      return;
    }
    setError(undefined);
    setProgress(0);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const blob = await upload(`drafts/${aid}/v${nextVersion}.${ext}`, file, {
        access: "public",
        handleUploadUrl: `/api/submit/${aid}/${sig}/upload`,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      const res = await fetch(`/api/submit/${aid}/${sig}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: blob.url, caption }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Saving the draft failed.");
      setFile(null);
      setCaption("");
      setProgress(undefined);
      router.refresh();
    } catch (err) {
      setProgress(undefined);
      setError(err instanceof Error ? err.message : "Upload failed. Check your connection and try again.");
    }
  }

  const uploading = progress !== undefined;

  return (
    <form onSubmit={submit} className="border-2 border-fb-black p-6 max-sm:p-4 space-y-5">
      <h2 className="headline text-3xl">{nextVersion === 1 ? "Your draft" : `Version ${nextVersion}`}</h2>

      <label className="block">
        <span className="text-sm font-bold">Video file</span>
        <span className="block text-xs">MP4 or MOV, up to {MAX_MB}MB. Vertical 9:16 works best.</span>
        <input
          type="file"
          accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.m4v"
          required
          disabled={disabled || uploading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-3 block w-full text-sm file:mr-4 file:border-2 file:border-fb-black file:bg-fb-white file:px-4 file:py-2 file:font-bold hover:file:bg-fb-black hover:file:text-fb-white disabled:opacity-50"
        />
      </label>

      <label className="block">
        <span className="text-sm font-bold">Caption you plan to post</span>
        <textarea
          rows={3}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={disabled || uploading}
          className="mt-2 w-full border-2 border-fb-black p-2 outline-none focus:border-fb-red disabled:opacity-50"
        />
      </label>

      {uploading && (
        <div aria-live="polite">
          <div className="h-2 bg-fb-black/10">
            <div className="h-full bg-fb-red transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm">Uploading {progress}%. Keep this page open.</p>
        </div>
      )}

      {disabled && <p className="text-sm">{disabledReason}</p>}
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}

      <button
        disabled={disabled || uploading || !file}
        className="subtitle bg-fb-red text-fb-white px-8 py-4 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
      >
        {uploading ? "Uploading" : "Send draft"}
      </button>
    </form>
  );
}
