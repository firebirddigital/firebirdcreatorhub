"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { timeAgo } from "@/lib/format";
import type { Creator } from "@/lib/types";

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
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const [copied, setCopied] = useState(false);

  async function addPost(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setMessage(undefined);
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, campaignId, creatorId: creatorId || undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; note?: string };
    setAdding(false);
    if (!res.ok) {
      setMessage({ text: data.error ?? "Couldn't add that link. Try again.", error: true });
      return;
    }
    setUrl("");
    setMessage({ text: data.note ?? "Post added with its latest stats." });
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
      setMessage({ text: data.error ?? data.errors?.join(" ") ?? "Refresh failed.", error: true });
    } else {
      const missed = data.missed?.length ? ` ${data.missed.length} couldn't be read.` : "";
      const linked = data.creatorsMatched ? ` Linked ${data.creatorsMatched} to creators.` : "";
      const added = data.creatorsCreated ? ` Added ${data.creatorsCreated} new creators to the roster.` : "";
      setMessage({ text: `Updated ${data.updated ?? 0} posts.${linked}${added}${missed}` });
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
    <section aria-label="Campaign tools" className="border-2 border-fb-black p-6 max-sm:p-4">
      <form onSubmit={addPost} className="grid gap-3 md:grid-cols-[1fr_220px_auto] items-end">
        <label className="block">
          <span className="text-sm font-bold">Add a live post</span>
          <input
            type="url"
            required
            placeholder="Paste an Instagram or TikTok link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={sample}
            className="mt-2 w-full border-b-2 border-fb-black bg-transparent py-2.5 outline-none focus:border-fb-red disabled:opacity-50"
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold">Creator</span>
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
          {adding ? "Adding post" : "Add post"}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <button
          onClick={refresh}
          disabled={sample || refreshing}
          className="font-bold underline underline-offset-4 hover:text-fb-red disabled:opacity-50 disabled:no-underline"
        >
          {refreshing ? "Refreshing stats" : "Refresh stats now"}
        </button>
        {shareUrl ? (
          <button onClick={copyShare} className="font-bold underline underline-offset-4 hover:text-fb-red">
            {copied ? "Share link copied" : "Copy client share link"}
          </button>
        ) : (
          <span>Tick “Sharing Enabled” on this campaign in Airtable to get a client link.</span>
        )}
        <span className="text-fb-black/70">Stats last updated {timeAgo(lastRefreshed)}</span>
      </div>

      {sample && <p className="mt-4 text-sm">Adding posts and refreshing stats turn on once Airtable and Apify are connected.</p>}
      {message && (
        <p role="status" className={`mt-4 text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
