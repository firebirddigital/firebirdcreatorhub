"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import type { Creator } from "@/lib/types";
import { BUTTON } from "./campaign/TeamControls";

/** Pull every link out of pasted text: one per line, comma-separated, or mixed in with other words. */
function extractLinks(text: string): string[] {
  const found = text.match(/(?:https?:\/\/|www\.|(?:[\w-]+\.)?(?:instagram\.com|instagr\.am|tiktok\.com)\/)[^\s,;<>"']+/gi) ?? [];
  const links = found.map((l) => l.replace(/[).\]]+$/, "")).map((l) => (/^https?:\/\//i.test(l) ? l : `https://${l}`));
  return [...new Set(links)];
}

export function CampaignTools({
  campaignId,
  creators,
  shareUrl,
  lastRefreshed,
  sample,
}: {
  campaignId: string;
  creators: Pick<Creator, "id" | "name">[];
  shareUrl?: string;
  lastRefreshed?: string;
  sample: boolean;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean; at: "actions" | "box" }>();
  const [copied, setCopied] = useState(false);

  const links = extractLinks(url);

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    if (!links.length) {
      setMessage({ text: "Paste at least one Instagram or TikTok link.", error: true, at: "box" });
      return;
    }
    setAdding(true);
    setMessage(undefined);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: links, campaignId, creatorId: creatorId || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      note?: string;
      added?: number;
      skipped?: { url: string; reason: "duplicate" | "unsupported" }[];
    };
    setAdding(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Couldn't add those links. Try again.", error: true, at: "box" });
      return;
    }
    const added = data.added ?? 1;
    const dupes = data.skipped?.filter((s) => s.reason === "duplicate").length ?? 0;
    const other = data.skipped?.filter((s) => s.reason === "unsupported").length ?? 0;
    const skippedText = [
      dupes ? `${dupes} already on this campaign` : "",
      other ? `${other} not Instagram or TikTok` : "",
    ].filter(Boolean).join(", ");
    const lead = added === 1 ? "Post added with its latest stats." : `${added} posts added with their latest stats.`;
    setUrl("");
    setMessage({ text: [lead, skippedText && `Skipped ${skippedText}.`, data.note].filter(Boolean).join(" "), at: "box" });
    router.refresh();
  }

  async function refresh() {
    setRefreshing(true);
    setMessage(undefined);
    const res = await fetch(`/api/refresh?campaign=${campaignId}`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      updated?: number;
      missed?: string[];
      errors?: string[];
      creatorsMatched?: number;
      creatorsCreated?: number;
    };
    setRefreshing(false);
    if (!res.ok || data.errors?.length) {
      setMessage({ text: data.error ?? data.errors?.join(" ") ?? "Refresh failed.", error: true, at: "actions" });
    } else {
      const missed = data.missed?.length ? ` ${data.missed.length} couldn't be read.` : "";
      const linked = data.creatorsMatched ? ` Linked ${data.creatorsMatched} to creators.` : "";
      const added = data.creatorsCreated ? ` Added ${data.creatorsCreated} new creators to the roster.` : "";
      setMessage({ text: `Updated ${data.updated ?? 0} posts.${linked}${added}${missed}`, at: "actions" });
    }
    router.refresh();
  }

  async function copyShare() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Campaign actions" className="flex flex-wrap items-center gap-3">
        <button onClick={refresh} disabled={sample || refreshing} className={BUTTON}>
          {refreshing ? "Refreshing stats" : "Refresh stats now"}
        </button>
        {shareUrl ? (
          <button onClick={copyShare} className={BUTTON}>
            {copied ? "Share link copied" : "Copy partner share link"}
          </button>
        ) : (
          <span className="text-sm">Tick “Partner link on” in Edit campaign to get a partner link.</span>
        )}
        <a href={`/campaigns/${campaignId}/report`} className={BUTTON}>
          Wrap report
        </a>
        <span className="text-sm">Stats last updated {timeAgo(lastRefreshed)}</span>
      </div>
      {message?.at === "actions" && (
        <p role="status" className={`text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}
    <section aria-label="Campaign tools" className="border-2 border-fb-black p-6 max-sm:p-4">
      <form onSubmit={addPost} className="grid gap-3 md:grid-cols-[1fr_220px_auto] items-end">
        <label className="block">
          <span className="text-sm font-bold">Add live posts</span>
          <textarea
            required
            rows={Math.min(Math.max(links.length, 1), 6)}
            placeholder="Paste Instagram or TikTok links, one per line"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={sample}
            className="mt-2 w-full resize-y border-b-2 border-fb-black bg-transparent py-2.5 outline-none focus:border-fb-red disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">{links.length > 1 ? "Creator (for every link)" : "Creator"}</span>
          <select
            value={creatorId}
            onChange={(e) => setCreatorId(e.target.value)}
            disabled={sample}
            className="mt-2 w-full border-b-2 border-fb-black bg-transparent py-2.5 outline-none focus:border-fb-red disabled:opacity-50"
          >
            <option value="">Detect from the post</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={sample || adding}
          className="subtitle bg-fb-red text-fb-white px-6 py-3.5 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
        >
          {adding
            ? links.length > 1 ? `Adding ${links.length} posts` : "Adding post"
            : links.length > 1 ? `Add ${links.length} posts` : "Add post"}
        </button>
      </form>

      {sample && <p className="mt-4 text-sm">Adding posts and refreshing stats turn on once Airtable and Apify are connected.</p>}
      {message?.at === "box" && (
        <p role="status" className={`mt-4 text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}
    </section>
    </div>
  );
}
