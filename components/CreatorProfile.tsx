"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { compact, creatorCpm, money, pct, timeAgo } from "@/lib/format";
import { pullStatsInBatches } from "@/lib/pull-stats";
import type { Creator } from "@/lib/types";
import { CreatorForm } from "./campaign/CreatorEditButton";

/**
 * Team only: a creator's full profile in a popup, opened from the creators page. Their numbers up top,
 * then every editable detail (rate, email, notes, tags…), saved straight to Airtable.
 */
export function CreatorProfile({
  creator: c,
  trackRecord,
  editable,
  onClose,
}: {
  creator?: Creator;
  trackRecord?: string;
  editable: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pulling, setPulling] = useState(false);
  const [pullNote, setPullNote] = useState<{ text: string; error?: boolean }>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (c && !d.open) d.showModal();
    if (!c && d.open) d.close();
  }, [c]);
  // A fresh note each time a different creator opens.
  useEffect(() => {
    setPullNote(undefined);
    setSaved(false);
  }, [c?.id]);

  async function pull() {
    if (!c) return;
    setPulling(true);
    setPullNote(undefined);
    try {
      const r = await pullStatsInBatches([c.id], () => {});
      setPullNote({ text: r.updated ? "Stats updated." : "Couldn't find their posts. Check the handles." , error: !r.updated });
      router.refresh();
    } catch (e) {
      setPullNote({ text: e instanceof Error ? e.message : String(e), error: true });
    }
    setPulling(false);
  }

  const cpm = c ? creatorCpm(c) : undefined;
  const stats: { label: string; value: string; note?: string }[] = c
    ? [
        ...(c.tiktok ? [{ label: "TikTok followers", value: c.tiktokFollowers ? compact(c.tiktokFollowers) : "—" }] : []),
        ...(c.instagram ? [{ label: "Instagram followers", value: c.instagramFollowers ? compact(c.instagramFollowers) : "—" }] : []),
        { label: "Median views", value: c.avgViews ? compact(c.avgViews) : "—", note: "Last 10 posts" },
        { label: "Engagement rate", value: c.engagementRate !== undefined ? pct(c.engagementRate) : "—", note: "Last 10 posts" },
        { label: "Rate", value: c.rate ? money(c.rate) : "—", note: "Per post" },
        { label: "CPM", value: cpm !== undefined ? money(cpm, 2) : "—", note: "Rate ÷ median views × 1,000" },
      ]
    : [];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={c ? `${c.name}'s profile` : "Creator profile"}
      className="sheet m-auto w-[min(46rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-y-auto"
    >
      {c && (
        <>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3.5">
            <h2 className="font-display text-xs font-bold uppercase tracking-[0.08em]">Creator profile</h2>
            <button type="button" onClick={onClose} className="btn btn-quiet btn-sm">
              Close
            </button>
          </div>
          <div className="space-y-5 p-5 max-sm:p-4">
            <header className="flex items-center gap-4">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-fb-ink">
                {c.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.photo} alt="" className="bw absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-xl font-extrabold uppercase text-white">
                    {c.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("")}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold uppercase tracking-[0.02em]">{c.name}</h3>
                <p className="flex flex-wrap gap-x-3 text-sm text-secondary">
                  {c.location && <span>{c.location}</span>}
                  {c.tiktok && (
                    <a href={`https://www.tiktok.com/@${c.tiktok}`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fb-red">
                      TikTok @{c.tiktok}
                    </a>
                  )}
                  {c.instagram && (
                    <a href={`https://www.instagram.com/${c.instagram}/`} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fb-red">
                      Instagram @{c.instagram}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="underline underline-offset-2 hover:text-fb-red">
                      {c.email}
                    </a>
                  )}
                </p>
              </div>
            </header>

            <dl className="grid grid-cols-3 gap-2.5 max-sm:grid-cols-2">
              {stats.map((s) => (
                <div key={s.label} className="rounded-card border border-line px-3 py-2.5">
                  <dt className="tile-label mb-0.5">{s.label}</dt>
                  <dd className="font-display text-lg font-extrabold tabular-nums">{s.value}</dd>
                  {s.note && <p className="text-[11px] text-muted">{s.note}</p>}
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
              <span>Track record: {trackRecord ?? "No campaigns yet"}</span>
              <span aria-hidden>·</span>
              <span>Stats updated {c.statsUpdated ? timeAgo(c.statsUpdated) : "never"}</span>
              {(c.tiktok || c.instagram) && (
                <button
                  type="button"
                  onClick={pull}
                  disabled={pulling || !editable}
                  title="Followers, median views and engagement from their last 10 posts. About $0.03 of Apify credit."
                  className="underline underline-offset-2 hover:text-fb-red disabled:no-underline disabled:opacity-60"
                >
                  {pulling ? "Pulling stats…" : "Pull fresh stats"}
                </button>
              )}
              {pullNote && <span className={pullNote.error ? "font-bold text-fb-red" : "font-bold"}>{pullNote.text}</span>}
            </div>

            <section className="border-t border-line pt-4">
              <h3 className="mb-3 flex items-center gap-3 font-display text-xs font-bold uppercase tracking-[0.08em]">
                Details
                {saved && <span className="font-sans text-xs font-bold normal-case tracking-normal text-secondary">Saved</span>}
              </h3>
              {/* Keyed by creator and their saved values, so the form shows what's in Airtable after a save. */}
              <CreatorForm
                key={JSON.stringify(c)}
                creator={c}
                disabled={!editable}
                note="Saves to Airtable and updates this creator everywhere in the hub. Email and notes are never shown to partners."
                onSaved={() => setSaved(true)}
              />
            </section>
          </div>
        </>
      )}
    </dialog>
  );
}
