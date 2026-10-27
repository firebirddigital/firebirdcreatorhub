"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseStreamsCsv } from "@/lib/csv-import";

const BUTTON =
  "subtitle border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50";

/** Team controls for streams: upload a Spotify for Artists CSV and choose whether partners see it. */
export function StreamsUpload({
  campaignId,
  hasStreams,
  shareWithPartner,
  uploadedAt,
}: {
  campaignId: string;
  hasStreams: boolean;
  shareWithPartner: boolean;
  uploadedAt?: string;
}) {
  const router = useRouter();
  const [song, setSong] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  async function upload(file: File) {
    setMessage(undefined);
    const parsed = parseStreamsCsv(await file.text());
    if (parsed.error) {
      setMessage({ text: parsed.error, error: true });
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaignId}/streams`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: parsed.days, song: song || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; days?: number; from?: string; to?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Upload failed. Try again.", error: true });
      return;
    }
    setMessage({
      text: `Saved. ${data.days} days of streams on file (${data.from} to ${data.to}).${parsed.skipped ? ` Skipped ${parsed.skipped} rows without a date or number.` : ""}`,
    });
    router.refresh();
  }

  async function toggleShare(next: boolean) {
    setBusy(true);
    const res = await fetch(`/api/campaigns/${campaignId}/streams`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shareWithPartner: next }),
    });
    setBusy(false);
    if (!res.ok) setMessage({ text: "Couldn't change sharing. Try again.", error: true });
    else router.refresh();
  }

  return (
    <div className="mt-6 border-2 border-fb-black p-5 space-y-4">
      <p className="text-sm">
        In Spotify for Artists, open the song, set the range to start at least a week before the campaign, and use the
        download (CSV) button. Upload it here; new uploads add to what&apos;s already saved.
        {uploadedAt ? ` Last upload ${new Date(uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` : ""}
      </p>
      <div className="flex flex-wrap items-end gap-4">
        <label className="min-w-56">
          <span className="text-xs font-bold">Song name (optional)</span>
          <input
            value={song}
            onChange={(e) => setSong(e.target.value)}
            className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 outline-none focus:border-fb-red"
          />
        </label>
        <label className={`${BUTTON} cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}>
          {busy ? "Saving" : hasStreams ? "Upload more streams" : "Upload streams CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
          />
        </label>
        {hasStreams && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Remove all saved streams for this campaign?")) return;
              setBusy(true);
              const res = await fetch(`/api/campaigns/${campaignId}/streams`, { method: "DELETE" });
              setBusy(false);
              setMessage(res.ok ? { text: "Streams removed." } : { text: "Couldn't remove them. Try again.", error: true });
              router.refresh();
            }}
            className="text-sm underline underline-offset-4 hover:text-fb-red"
          >
            Remove streams
          </button>
        )}
        {hasStreams && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={shareWithPartner}
              disabled={busy}
              onChange={(e) => toggleShare(e.target.checked)}
              className="size-4 accent-fb-red"
            />
            <span>
              <span className="font-bold">Show streams to partner.</span> Off by default; stream numbers are confidential.
            </span>
          </label>
        )}
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.error ? "font-bold text-fb-red" : ""}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
