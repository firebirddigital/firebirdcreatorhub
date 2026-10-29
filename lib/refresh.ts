import { createRecords, updateRecords } from "./airtable";
import { fetchInstagramStats, fetchTikTokStats, type PostAuthor, type PostResult } from "./apify";
import {
  CREATOR_FIELDS as CRF,
  POST_FIELDS as PF,
  SNAPSHOT_FIELDS as SF,
  TABLES,
  isSampleMode,
} from "./config";
import { getCreators, getPosts } from "./data";
import { addCreatorsToCampaign } from "./roster";
import { postKey } from "./social";

export interface RefreshResult {
  checked: number;
  updated: number;
  creatorsMatched: number;
  creatorsCreated: number;
  missed: string[];
  errors: string[];
}

const authorKey = (a: PostAuthor) => `${a.platform}:${a.handle.toLowerCase()}`;

/**
 * Fetches fresh stats for live posts, writes them onto each post and logs a snapshot.
 * Posts with no creator are matched to the Creators table by handle; unknown handles become
 * new creators. Matched creators are added to the post's campaign.
 * Scope with campaignId (one campaign) or postIds (specific posts); no scope = every live post.
 */
export async function refreshStats(opts: { campaignId?: string; postIds?: string[] } = {}): Promise<RefreshResult> {
  if (isSampleMode()) {
    return { checked: 0, updated: 0, creatorsMatched: 0, creatorsCreated: 0, missed: [], errors: ["Sample mode: connect Airtable first."] };
  }

  const posts = (await getPosts({ fresh: true })).filter(
    (p) =>
      p.status === "Live" &&
      (!opts.campaignId || p.campaignId === opts.campaignId) &&
      (!opts.postIds || opts.postIds.includes(p.id)),
  );

  const errors: string[] = [];
  const results = new Map<string, PostResult>();
  const igUrls = posts.filter((p) => p.platform === "instagram").map((p) => p.url);
  const ttUrls = posts.filter((p) => p.platform === "tiktok").map((p) => p.url);

  const [ig, tt] = await Promise.allSettled([fetchInstagramStats(igUrls), fetchTikTokStats(ttUrls)]);
  if (ig.status === "fulfilled") ig.value.forEach((v, k) => results.set(k, v));
  else errors.push(`Instagram: ${ig.reason instanceof Error ? ig.reason.message : ig.reason}`);
  if (tt.status === "fulfilled") tt.value.forEach((v, k) => results.set(k, v));
  else errors.push(`TikTok: ${tt.reason instanceof Error ? tt.reason.message : tt.reason}`);

  // ---- Match post authors to creators ----
  const creators = await getCreators({ fresh: true });
  const creatorByHandle = new Map<string, string>();
  for (const c of creators) {
    if (c.instagram) creatorByHandle.set(`instagram:${c.instagram.toLowerCase()}`, c.id);
    if (c.tiktok) creatorByHandle.set(`tiktok:${c.tiktok.toLowerCase()}`, c.id);
  }

  const newAuthors = new Map<string, PostAuthor>();
  for (const p of posts) {
    const a = results.get(postKey(p.url))?.author;
    if (!p.creatorId && a && !creatorByHandle.has(authorKey(a))) newAuthors.set(authorKey(a), a);
  }

  let creatorsCreated = 0;
  if (newAuthors.size) {
    const authors = [...newAuthors.values()];
    const created = await createRecords(
      TABLES.creators,
      authors.map((a) => ({
        fields: {
          [CRF.name]: a.name ?? a.handle,
          [a.platform === "instagram" ? CRF.instagram : CRF.tiktok]: a.handle,
          ...(a.followers
            ? { [a.platform === "instagram" ? CRF.instagramFollowers : CRF.tiktokFollowers]: a.followers }
            : {}),
          [CRF.notes]: "Added automatically from a campaign post. Add tags and rate.",
        },
      })),
    );
    created.forEach((rec, i) => creatorByHandle.set(authorKey(authors[i]), rec.id));
    creatorsCreated = created.length;
  }

  // ---- Write stats, creator links and snapshots ----
  const now = new Date().toISOString();
  const postUpdates: { id: string; fields: Record<string, unknown> }[] = [];
  const snapshots: { fields: Record<string, unknown> }[] = [];
  const followerUpdates = new Map<string, Record<string, unknown>>();
  const campaignAdds = new Map<string, Set<string>>();
  const missed: string[] = [];
  let creatorsMatched = 0;

  for (const p of posts) {
    const platformFailed =
      (p.platform === "instagram" && ig.status === "rejected") ||
      (p.platform === "tiktok" && tt.status === "rejected");
    if (platformFailed) continue;

    const r = results.get(postKey(p.url));
    if (!r) {
      missed.push(p.url);
      postUpdates.push({
        id: p.id,
        fields: { [PF.refreshNote]: "No stats returned. Check the link is public and correct." },
      });
      continue;
    }

    const fields: Record<string, unknown> = {
      // Counts only go up on live posts; ignore a scraper glitch that reports zero.
      [PF.views]: r.views || p.views,
      [PF.likes]: r.likes || p.likes,
      [PF.comments]: r.comments || p.comments,
      [PF.shares]: r.shares || p.shares,
      [PF.lastRefreshed]: now,
      [PF.refreshNote]: "",
    };

    let creatorId = p.creatorId;
    if (!creatorId && r.author) {
      creatorId = creatorByHandle.get(authorKey(r.author));
      if (creatorId) {
        fields[PF.creator] = [creatorId];
        creatorsMatched++;
      }
    }
    if (creatorId && r.author?.followers) {
      followerUpdates.set(creatorId, {
        ...followerUpdates.get(creatorId),
        [r.author.platform === "instagram" ? CRF.instagramFollowers : CRF.tiktokFollowers]: r.author.followers,
      });
    }
    if (creatorId && p.campaignId) {
      campaignAdds.set(p.campaignId, (campaignAdds.get(p.campaignId) ?? new Set()).add(creatorId));
    }

    postUpdates.push({ id: p.id, fields });
    snapshots.push({
      fields: {
        [SF.post]: [p.id],
        ...(p.campaignId ? { [SF.campaign]: [p.campaignId], [SF.campaignRecordId]: p.campaignId } : {}),
        [SF.capturedAt]: now,
        [SF.views]: fields[PF.views],
        [SF.likes]: fields[PF.likes],
        [SF.comments]: fields[PF.comments],
        [SF.shares]: fields[PF.shares],
      },
    });
  }

  if (postUpdates.length) await updateRecords(TABLES.posts, postUpdates);
  if (snapshots.length) await createRecords(TABLES.snapshots, snapshots);

  // Keep follower counts current; failures here shouldn't fail the refresh
  try {
    if (followerUpdates.size) {
      await updateRecords(
        TABLES.creators,
        [...followerUpdates].map(([id, fields]) => ({ id, fields })),
      );
    }
    // Creators found on live posts are booked on the campaign roster as approved
    for (const [campaignId, creatorIds] of campaignAdds) {
      await addCreatorsToCampaign(campaignId, [...creatorIds], "Approved");
    }
  } catch (e) {
    errors.push(`Creator details: ${e instanceof Error ? e.message : String(e)}`);
  }

  return { checked: posts.length, updated: snapshots.length, creatorsMatched, creatorsCreated, missed, errors };
}
