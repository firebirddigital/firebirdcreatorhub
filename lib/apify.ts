// Pulls public post stats through Apify scraper actors.
// Swap actors with APIFY_INSTAGRAM_ACTOR / APIFY_TIKTOK_ACTOR; field mapping below tolerates
// the naming used by the common actors.
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

export interface ProfileStats {
  platform: Platform;
  handle: string;
  name?: string;
  followers?: number;
  avgViews?: number;
  videos: number;
}

const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : undefined);

/** Followers and average views across each account's recent videos. Keyed like `tiktok:handle`. */
export async function fetchProfileStats(
  accounts: { platform: Platform; handle: string }[],
): Promise<Map<string, ProfileStats>> {
  const out = new Map<string, ProfileStats>();
  const tt = accounts.filter((a) => a.platform === "tiktok").map((a) => a.handle);
  const ig = accounts.filter((a) => a.platform === "instagram").map((a) => a.handle);

  const [ttItems, igItems] = await Promise.all([
    tt.length
      ? runActor(TT_ACTOR(), {
          profiles: tt,
          resultsPerPage: 12,
          shouldDownloadVideos: false,
          shouldDownloadCovers: false,
          shouldDownloadSubtitles: false,
        })
      : Promise.resolve([] as Item[]),
    ig.length
      ? runActor(IG_ACTOR(), {
          directUrls: ig.map((h) => `https://www.instagram.com/${h}/`),
          resultsType: "details",
          resultsLimit: 1,
        })
      : Promise.resolve([] as Item[]),
  ]);

  // TikTok: one item per video; group by author
  const byAuthor = new Map<string, { name?: string; followers?: number; views: number[] }>();
  for (const it of ttItems) {
    const meta = (it.authorMeta ?? {}) as Item;
    const handle = s(meta.name, meta.uniqueId)?.toLowerCase();
    if (!handle) continue;
    const g = byAuthor.get(handle) ?? { views: [] };
    g.name ??= s(meta.nickName, meta.nickname);
    g.followers ??= n(meta.fans, meta.followerCount) || undefined;
    const v = n(it.playCount, ((it.stats ?? {}) as Item).playCount);
    if (v) g.views.push(v);
    byAuthor.set(handle, g);
  }
  byAuthor.forEach((g, handle) =>
    out.set(`tiktok:${handle}`, {
      platform: "tiktok",
      handle,
      name: g.name,
      followers: g.followers,
      avgViews: mean(g.views),
      videos: g.views.length,
    }),
  );

  // Instagram: one "details" item per profile, with its latest posts
  for (const it of igItems) {
    const handle = s(it.username)?.toLowerCase();
    if (!handle) continue;
    const posts = (Array.isArray(it.latestPosts) ? it.latestPosts : []) as Item[];
    const views = posts.map((p) => n(p.videoPlayCount, p.videoViewCount)).filter((v) => v > 0);
    out.set(`instagram:${handle}`, {
      platform: "instagram",
      handle,
      name: s(it.fullName),
      followers: n(it.followersCount) || undefined,
      avgViews: mean(views),
      videos: views.length,
    });
  }
  return out;
}
