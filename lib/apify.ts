// Pulls public post stats through Apify scraper actors.
// Swap actors with APIFY_INSTAGRAM_ACTOR / APIFY_TIKTOK_ACTOR; field mapping below tolerates
// the naming used by the common actors.
import { median } from "./format";
import { handleFromUrl, instagramCode, postKey, tiktokId } from "./social";
import type { Platform, Stats } from "./types";

export interface PostAuthor {
  platform: Platform;
  handle: string;
  name?: string;
  followers?: number;
}

export interface PostResult extends Stats {
  author?: PostAuthor;
}

const IG_ACTOR = () => process.env.APIFY_INSTAGRAM_ACTOR || "apify~instagram-scraper";
const TT_ACTOR = () => process.env.APIFY_TIKTOK_ACTOR || "clockworks~tiktok-scraper";

type Item = Record<string, unknown>;

async function runActor(actor: string, input: object): Promise<Item[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN is not set");
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=240&clean=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify ${actor} failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as Item[];
}

const n = (...vals: unknown[]) => {
  for (const v of vals) if (typeof v === "number" && isFinite(v)) return v;
  return 0;
};
const s = (...vals: unknown[]) => {
  for (const v of vals) if (typeof v === "string" && v) return v;
  return undefined;
};

/** Returns stats keyed by postKey(url) so they can be matched back to posts. */
export async function fetchInstagramStats(urls: string[]): Promise<Map<string, PostResult>> {
  const out = new Map<string, PostResult>();
  if (!urls.length) return out;
  const items = await runActor(IG_ACTOR(), {
    directUrls: urls,
    resultsType: "posts",
    resultsLimit: 1,
    addParentData: false,
  });
  for (const it of items) {
    const code = s(it.shortCode, it.shortcode, it.code) ?? instagramCode(s(it.url, it.inputUrl) ?? "");
    if (!code) continue;
    out.set(`instagram:${code}`, {
      views: n(it.videoPlayCount, it.videoViewCount, it.playCount, it.play_count, it.views),
      likes: Math.max(0, n(it.likesCount, it.like_count, it.likes)),
      comments: n(it.commentsCount, it.comment_count, it.comments),
      shares: n(it.sharesCount, it.reshareCount, it.shares),
      author: author("instagram", s(it.ownerUsername, (it.owner as Item | undefined)?.username), s(it.ownerFullName)),
    });
  }
  return out;
}

export async function fetchTikTokStats(urls: string[]): Promise<Map<string, PostResult>> {
  const out = new Map<string, PostResult>();
  if (!urls.length) return out;
  const items = await runActor(TT_ACTOR(), {
    postURLs: urls,
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  });
  for (const it of items) {
    const stats = (it.stats ?? {}) as Item;
    const meta = (it.authorMeta ?? it.author ?? {}) as Item;
    const id = s(it.id, it.aweme_id) ?? tiktokId(s(it.webVideoUrl, it.url, it.submittedVideoUrl) ?? "");
    const key = id ? `tiktok:${id}` : postKey(s(it.submittedVideoUrl, it.webVideoUrl) ?? "");
    out.set(key, {
      views: n(it.playCount, stats.playCount, it.views),
      likes: n(it.diggCount, stats.diggCount, it.likes),
      comments: n(it.commentCount, stats.commentCount, it.comments),
      shares: n(it.shareCount, stats.shareCount, it.shares),
      author: author(
        "tiktok",
        s(meta.name, meta.uniqueId, it.authorUsername) ?? handleFromUrl(s(it.webVideoUrl, it.submittedVideoUrl) ?? ""),
        s(meta.nickName, meta.nickname),
        n(meta.fans, meta.followerCount) || undefined,
      ),
    });
    // Short links (vm.tiktok.com) only match through the URL that was submitted
    const submitted = s(it.submittedVideoUrl, it.inputUrl);
    if (submitted) out.set(postKey(submitted), out.get(key)!);
  }
  return out;
}

function author(platform: Platform, handle?: string, name?: string, followers?: number): PostAuthor | undefined {
  const h = handle?.replace(/^@/, "").trim();
  return h ? { platform, handle: h, name: name?.trim() || undefined, followers } : undefined;
}

/** How many of a creator's most recent posts the average views covers. */
export const RECENT_POSTS = 10;

export interface RecentPost {
  views: number;
  /** ISO time it was posted, when the scraper gives one. */
  at?: string;
}

export interface ProfileStats {
  platform: Platform;
  handle: string;
  name?: string;
  followers?: number;
  /** Median views across the account's last RECENT_POSTS posts that report views. */
  avgViews?: number;
  /** Posts that went into the median (photos have no view count, so this can be under 10). */
  videos: number;
  /** The posts behind the average, newest first, so two platforms can be combined by date. */
  recent: RecentPost[];
}


/** Newest first, capped at RECENT_POSTS. Posts without a date keep the scraper's order (which is newest first). */
export function latest(posts: RecentPost[]): RecentPost[] {
  return [...posts]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (a.p.at && b.p.at ? b.p.at.localeCompare(a.p.at) : a.i - b.i))
    .map(({ p }) => p)
    .slice(0, RECENT_POSTS);
}

const iso = (v: unknown) => {
  if (typeof v === "string" && !isNaN(Date.parse(v))) return new Date(v).toISOString();
  if (typeof v === "number" && v > 0) return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  return undefined;
};

/**
 * Followers and median views across each account's last 10 posts. Keyed like `tiktok:handle`.
 * Instagram needs two runs: the profile (name, followers) and its 10 latest posts (views).
 */
export async function fetchProfileStats(
  accounts: { platform: Platform; handle: string }[],
): Promise<Map<string, ProfileStats>> {
  const out = new Map<string, ProfileStats>();
  const tt = accounts.filter((a) => a.platform === "tiktok").map((a) => a.handle);
  const ig = accounts.filter((a) => a.platform === "instagram").map((a) => a.handle);
  const igUrls = ig.map((h) => `https://www.instagram.com/${h}/`);

  const [ttItems, igProfiles, igPosts] = await Promise.all([
    tt.length
      ? runActor(TT_ACTOR(), {
          profiles: tt,
          resultsPerPage: RECENT_POSTS,
          // Pinned posts are usually the creator's biggest hits; leaving them in inflates the number.
          excludePinnedPosts: true,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
        })
      : Promise.resolve([] as Item[]),
    ig.length ? runActor(IG_ACTOR(), { directUrls: igUrls, resultsType: "details", resultsLimit: 1 }) : Promise.resolve([] as Item[]),
    ig.length
      ? runActor(IG_ACTOR(), { directUrls: igUrls, resultsType: "posts", resultsLimit: RECENT_POSTS, addParentData: false })
      : Promise.resolve([] as Item[]),
  ]);

  // TikTok: one item per video; group by author
  const byAuthor = new Map<string, { name?: string; followers?: number; posts: RecentPost[] }>();
  for (const it of ttItems) {
    const meta = (it.authorMeta ?? {}) as Item;
    const handle = s(meta.name, meta.uniqueId)?.toLowerCase();
    if (!handle) continue;
    const g = byAuthor.get(handle) ?? { posts: [] };
    g.name ??= s(meta.nickName, meta.nickname);
    g.followers ??= n(meta.fans, meta.followerCount) || undefined;
    const v = n(it.playCount, ((it.stats ?? {}) as Item).playCount);
    if (v && it.isPinned !== true) g.posts.push({ views: v, at: iso(it.createTimeISO ?? it.createTime) });
    byAuthor.set(handle, g);
  }
  byAuthor.forEach((g, handle) => {
    const recent = latest(g.posts);
    out.set(`tiktok:${handle}`, {
      platform: "tiktok",
      handle,
      name: g.name,
      followers: g.followers,
      avgViews: median(recent.map((p) => p.views)),
      videos: recent.length,
      recent,
    });
  });

  // Instagram: name and followers from the profile; views from the latest posts (videos and reels only)
  const igPostsBy = new Map<string, RecentPost[]>();
  for (const p of igPosts) {
    const handle = s(p.ownerUsername, (p.owner as Item | undefined)?.username)?.toLowerCase();
    const v = n(p.videoPlayCount, p.videoViewCount, p.playCount);
    if (!handle || !v || p.isPinned === true) continue;
    igPostsBy.set(handle, [...(igPostsBy.get(handle) ?? []), { views: v, at: iso(p.timestamp ?? p.takenAt) }]);
  }
  for (const it of igProfiles) {
    const handle = s(it.username)?.toLowerCase();
    if (!handle) continue;
    // Fall back to the profile's own latest posts if the posts run came back empty
    const fallback = ((Array.isArray(it.latestPosts) ? it.latestPosts : []) as Item[])
      .map((p) => ({ views: n(p.videoPlayCount, p.videoViewCount), at: iso(p.timestamp) }))
      .filter((p) => p.views > 0);
    const recent = latest(igPostsBy.get(handle)?.length ? igPostsBy.get(handle)! : fallback);
    out.set(`instagram:${handle}`, {
      platform: "instagram",
      handle,
      name: s(it.fullName),
      followers: n(it.followersCount) || undefined,
      avgViews: median(recent.map((p) => p.views)),
      videos: recent.length,
      recent,
    });
  }
  return out;
}
