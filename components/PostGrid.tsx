"use client";

import { useMemo, useState } from "react";
import { compact, shortDate, timeAgo, times } from "@/lib/format";
import { embedUrl, PLATFORM_LABEL } from "@/lib/social";
import type { Creator, Platform, Post } from "@/lib/types";

type PostWithCreator = Post & { creator?: Creator };
type Sort = "views" | "newest" | "engagement";

export function PostGrid({
  posts,
  sample,
  internal,
}: {
  posts: PostWithCreator[];
  sample: boolean;
  internal: boolean;
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

  return (
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
          </select>
        </label>
      </div>

      <ul className="mt-8 grid gap-x-6 gap-y-12 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
        {shown.map((p) => (
          <li key={p.id}>
            <PostCard post={p} sample={sample} internal={internal} />
          </li>
        ))}
      </ul>
    </div>
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

      {internal && post.refreshNote && <p className="mt-2 text-sm text-fb-red">{post.refreshNote}</p>}
      {internal && !post.refreshNote && post.lastRefreshed && (
        <p className="mt-2 text-xs text-fb-black/60">Updated {timeAgo(post.lastRefreshed)}</p>
      )}
    </article>
  );
}

/** "3.2× their usual": this post's views against the creator's last-20-post average. */
function VsUsual({ views, usual, name }: { views: number; usual: number; name: string }) {
  const r = views / usual;
  return (
    <p
      className={`mt-2 text-sm ${r >= 1.5 ? "font-bold text-fb-red" : r < 0.5 ? "text-fb-black/60" : ""}`}
      title={`${name} usually gets ${compact(usual)} views (average of their last 20 posts)`}
    >
      {times(views, usual)} their usual <span className="font-normal text-fb-black/60">({compact(usual)} avg, last 20 posts)</span>
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
