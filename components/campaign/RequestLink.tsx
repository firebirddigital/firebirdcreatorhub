"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortDate } from "@/lib/format";
import { BUTTON } from "./TeamControls";

export interface RequestOption {
  id: string;
  name: string;
  artist: string;
  source: "influencer" | "seeding";
  createdTime: string;
  hubStatus: "New" | "Accepted" | "Dismissed";
  linked: boolean;
}

/**
 * Team only: ties a campaign made by hand to the Airtable form submission it came from, pulling in the
 * partner contacts and any details still blank (brief, dates, budget, song, type).
 */
export function RequestLink({ campaignId, artist, requests, sample }: { campaignId: string; artist: string; requests: RequestOption[]; sample: boolean }) {
  const router = useRouter();
  const linked = requests.filter((r) => r.linked);
  const sameArtist = (r: RequestOption) => Boolean(artist) && r.artist.toLowerCase().includes(artist.toLowerCase());
  // Same artist first, then new before already-handled, newest first within each.
  const options = requests
    .filter((r) => !r.linked)
    .sort(
      (a, b) =>
        Number(sameArtist(b)) - Number(sameArtist(a)) ||
        Number(b.hubStatus === "New") - Number(a.hubStatus === "New") ||
        b.createdTime.localeCompare(a.createdTime),
    );
  const [pick, setPick] = useState(options.find(sameArtist)?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  async function link() {
    setBusy(true);
    setMessage(undefined);
    const res = await fetch(`/api/requests/${pick}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "link", campaignId }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; filled?: string[]; contactsSaved?: boolean };
    setBusy(false);
    if (!res.ok) return setMessage({ text: data.error ?? "That didn't work. Try again.", error: true });
    const filled = data.filled ?? [];
    setMessage({
      text: [
        filled.length ? `Filled in the ${filled.join(", ")}.` : "Nothing was blank, so the campaign details stay as they are.",
        data.contactsSaved === false
          ? "Partner contacts weren't saved: add a “Partner Contacts” long text field to Campaigns in Airtable."
          : "Added the partner contacts.",
      ].join(" "),
    });
    router.refresh();
  }

  if (!linked.length && !options.length) return null;

  return (
    <section aria-label="Airtable request" className="-mt-10 text-sm">
      {linked.map((r) => (
        <p key={r.id}>
          <span className="text-xs font-bold">From the Airtable request</span> {r.name}, submitted {shortDate(r.createdTime)}
        </p>
      ))}
      {options.length > 0 && (
        <details className="mt-1" open={!linked.length && options.some(sameArtist)}>
          <summary className="cursor-pointer text-xs font-bold underline underline-offset-4 hover:text-fb-red">
            {linked.length ? "Link another Airtable request" : "Link this campaign to an Airtable request"}
          </summary>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              disabled={busy || sample}
              className="max-w-full border-b-2 border-fb-black bg-transparent py-1.5 font-bold outline-none focus:border-fb-red"
            >
              <option value="">Pick a request…</option>
              {options.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.artist} · {r.name} ({r.source === "influencer" ? "Influencer" : "Seeding"}, {shortDate(r.createdTime)}
                  {r.hubStatus !== "New" ? `, ${r.hubStatus.toLowerCase()}` : ""})
                </option>
              ))}
            </select>
            <button onClick={link} disabled={!pick || busy || sample} className={BUTTON}>
              {busy ? "Pulling in" : "Pull in details"}
            </button>
          </div>
          <p className="mt-2 text-xs">
            Adds the request&apos;s partner contacts and fills in the brief, dates, budget, song and type where they&apos;re blank. Nothing you&apos;ve
            already entered is overwritten.
          </p>
          {sample && <p className="mt-1 text-xs">Sample requests. Linking turns on once Airtable is connected.</p>}
        </details>
      )}
      {message && (
        <p role="status" className={`mt-2 ${message.error ? "font-bold text-fb-red" : ""}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
