"use client";

import { useMemo, useState } from "react";
import { compact, cpmVsExpected, money, shortDate, timeAgo, times } from "@/lib/format";
import { embedUrl, PLATFORM_LABEL } from "@/lib/social";
import { BulkBar, BulkSelectProvider, SelectBox } from "./campaign/BulkSelect";
import { PostEditor } from "./campaign/PostEditor";
import type { CampaignView, Platform, Post } from "@/lib/types";

type PostWithCreator = CampaignView["posts"][number];
type Sort = "views" | "newest" | "engagement" | "cpm";

/** This post's cost per 1,000 views so far. */
const postCpm = (p: PostWithCreator) => (p.cost && p.views ? (p.cost.amount / p.views) * 1000 : undefined);

export function PostGrid({
  posts,
  sample,
  internal,
  campaignId,
  creators,
}: {
  posts: PostWithCreator[];
  sample: boolean;
  internal: boolean;
  /** Team view: lets the team select posts and delete them. */
  campaignId?: string;
  /** Team view: creators to choose from when editing a post. */
  creators?: { id: string; name: string }[];
}) {
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [sort, setSort] = useState<Sort>("views");

  const shown = useMemo(() => {
    const list = posts.filter((p) => platform === "all" || p.platform === platform);
    const er = (p: Post) => (p.views ? (p.likes + p.comments + p.shares) / p.views : 0);
    return [...list].sort((a, b) =>
      sort === "views"
        ? b.views - a.views
        : sort === "newest"
          ? (b.postedAt ?? "").localeCompare(a.postedAt ?? "")
          : sort === "cpm"
            ? (postCpm(a) ?? Infinity) - (postCpm(b) ?? Infinity)
            : er(b) - er(a),
    );
  }, [posts, platform, sort]);

  const counts = {
    all: posts.length,
    instagram: posts.filter((p) => p.platform === "instagram").length,
    tiktok: posts.filter((p) => p.platform === "tiktok").length,
  };

  if (!posts.length) {
    return (
      <p className="max-w-prose">
        No posts yet.{" "}
        {internal ? "Paste the first live link above and its stats will load in about a minute." : "Check back soon."}
      </p>
    );
  }

  const grid = (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Filter by platform" className="flex border-2 border-fb-black">
          {(["all", "tiktok", "instagram"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setPlatform(key)}
              aria-pressed={platform === key}
              className={`px-4 py-2 text-sm font-bold ${platform === key ? "bg-fb-black text-fb-white" : "hover:bg-fb-black/5"}`}
            >
              {key === "all" ? "All" : PLATFORM_LABEL[key]} <span className="font-normal">{counts[key]}</span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          Sort by
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="border-2 border-fb-black bg-fb-white px-3 py-2 font-bold"
          >
            <option value="views">Most views</option>
            <option value="engagement">Highest engagement</option>
            <option value="newest">Newest</option>
            {posts.some((p) => p.cost) && <option value="cpm">Lowest CPM</option>}
          </select>
        </label>
      </div>

      <ul className="mt-8 grid gap-x-6 gap-y-12 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {shown.map((p) => (
          <li key={p.id} className="relative">
            <SelectBox id={p.id} label={`post by ${p.creator?.name ?? "creator"}`} />
            <PostCard post={p} sample={sample} internal={internal} />
            {internal && campaignId && creators && (
              <PostEditor campaignId={campaignId} postId={p.id} creatorId={p.creatorId} postedAt={p.postedAt} creators={creators} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
  if (!internal || !campaignId) return grid;
  return (
    <BulkSelectProvider>
      <BulkBar
        allIds={shown.map((p) => p.id)}
        noun={["post", "posts"]}
        action="Delete posts"
        confirmText="Delete {items} from this campaign? Their views stop counting toward the totals and charts. This can't be undone from the hub."
        endpoint={`/api/campaigns/${campaignId}/posts`}
        bodyKey="postIds"
      />
      <div className="mt-6">{grid}</div>
    </BulkSelectProvider>
  );
}

function PostCard({ post, sample, internal }: { post: PostWithCreator; sample: boolean; internal: boolean }) {
  const src = sample ? undefined : embedUrl(post.url);
  const handle = post.platform === "instagram" ? post.creator?.instagram : post.creator?.tiktok;

  return (
    <article>
      <div className="relative aspect-[9/16] bg-fb-black overflow-hidden">
        {src ? (
          <iframe
            src={src}
            title={`${PLATFORM_LABEL[post.platform]} post by ${post.creator?.name ?? "creator"}`}
            loading="lazy"
            allow="encrypted-media; fullscreen; picture-in-picture"
            className="absolute inset-0 h-full w-full border-0 bg-fb-white"
          />
        ) : (
          <a
            href={post.url}
            target="_blank"
            rel="noreferrer"
            className="absolute inset-0 flex flex-col justify-between p-5 text-fb-white"
          >
            <span className="subtitle text-xs">{PLATFORM_LABEL[post.platform]}</span>
            <span>
              <span className="figure block text-6xl text-fb-red">{compact(post.views)}</span>
              <span className="mt-2 block text-sm">views</span>
            </span>
            {sample && <span className="text-xs text-fb-white/70">Sample post. Real posts play here.</span>}
          </a>
        )}
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold truncate">{post.creator?.name ?? "Unassigned creator"}</p>
          <p className="text-sm truncate">
            {handle ? `@${handle}` : PLATFORM_LABEL[post.platform]}
            {post.postedAt ? `, posted ${shortDate(post.postedAt)}` : ""}
          </p>
        </div>
        <a
          href={post.url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-sm underline underline-offset-4 hover:text-fb-red"
        >
          Open post
        </a>
      </div>

      <dl className="mt-3 grid grid-cols-4 border-t-2 border-fb-black pt-3">
        <Stat label="Views" value={post.views} strong />
        <Stat label="Likes" value={post.likes} />
        <Stat label="Comments" value={post.comments} />
        <Stat label="Shares" value={post.shares} />
      </dl>

      {post.creator?.avgViews ? <VsUsual views={post.views} usual={post.creator.avgViews} name={post.creator.name} /> : null}
      {post.cost && <PostCost post={post} internal={internal} />}

      {internal && post.refreshNote && <p className="mt-2 text-sm text-fb-red">{post.refreshNote}</p>}
      {internal && !post.refreshNote && post.lastRefreshed && (
        <p className="mt-2 text-xs text-fb-black/60">Updated {timeAgo(post.lastRefreshed)}</p>
      )}
    </article>
  );
}

/**
 * What this post cost and its CPM so far, against its expected CPM (cost ÷ their median views, last 10 posts).
 * Team pages mark a better-than-expected CPM green; partner pages stay red, black and white.
 */
function PostCost({ post, internal }: { post: PostWithCreator; internal: boolean }) {
  const cost = post.cost!;
  const now = postCpm(post);
  const avg = post.creator?.avgViews ? (cost.amount / post.creator.avgViews) * 1000 : undefined;
  const vs = cpmVsExpected(now, avg);
  const tone = vs ? (vs.under ? (internal ? "text-green-700" : "") : "text-fb-red") : "";
  const paidNote = [
    cost.basis === "rate" ? "their rate (no fee set)" : "",
    cost.splitAcross > 1 ? `fee split across their ${cost.splitAcross} posts` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <dl className="mt-3 grid grid-cols-3 border-t border-fb-black/20 pt-3 text-sm">
      <div title={paidNote || "The creator's fee for this post"}>
        <dt className="text-xs">Paid{cost.basis === "rate" ? " (rate)" : ""}</dt>
        <dd className="figure mt-1 text-lg">{money(cost.amount)}</dd>
      </div>
      <div title="Paid ÷ this post's views × 1,000">
        <dt className="text-xs">CPM now</dt>
        <dd className={`figure mt-1 text-lg ${tone}`}>{now !== undefined ? money(now, 2) : "—"}</dd>
      </div>
      <div title="Paid ÷ their median views (last 10 posts) × 1,000">
        <dt className="text-xs">Expected CPM</dt>
        <dd className="figure mt-1 text-lg">{avg !== undefined ? money(avg, 2) : "—"}</dd>
      </div>
      {vs && (
        <p className={`col-span-3 mt-1 text-xs font-bold ${tone}`}>
          {vs.under && !internal && <span aria-hidden>↓ </span>}
          {vs.text}
        </p>
      )}
    </dl>
  );
}

/** "3.2× their usual": this post's views against the creator's last-10-post median. */
function VsUsual({ views, usual, name }: { views: number; usual: number; name: string }) {
  const r = views / usual;
  return (
    <p
      className={`mt-2 text-sm ${r >= 1.5 ? "font-bold text-fb-red" : r < 0.5 ? "text-fb-black/60" : ""}`}
      title={`${name} usually gets ${compact(usual)} views (median of their last 10 posts)`}
    >
      {times(views, usual)} their usual <span className="font-normal text-fb-black/60">({compact(usual)} median, last 10 posts)</span>
    </p>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <dt className="text-xs">{label}</dt>
      <dd className={`figure mt-1 text-lg ${strong ? "text-fb-red" : ""}`}>{compact(value)}</dd>
    </div>
  );
}
