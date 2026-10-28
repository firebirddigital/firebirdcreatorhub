import { type AirtableRecord, firstAttachment, ids, listAll, num, str, strings } from "./airtable";
import {
  ASSIGNMENT_FIELDS as AF,
  CAMPAIGN_FIELDS as CF,
  DRAFT_FIELDS as DF,
  CREATOR_FIELDS as CRF,
  POST_FIELDS as PF,
  SNAPSHOT_FIELDS as SF,
  TABLES,
  isSampleMode,
} from "./config";
import { detectPlatform } from "./social";
import { expectedCpm } from "./format";
import { CAMPAIGN_TYPES, parsePlatforms } from "./types";
import {
  sampleAssignments,
  sampleCampaigns,
  sampleCreators,
  sampleDrafts,
  samplePosts,
  sampleSnapshots,
} from "./sample-data";
import type {
  TrackRecord,
  Benchmark,
  Assignment,
  AssignmentStatus,
  Campaign,
  CampaignStatus,
  CampaignView,
  Creator,
  CreatorPerformance,
  Draft,
  DraftStatus,
  IncomingPost,
  Platform,
  Post,
  SeriesPoint,
  Snapshot,
  Stage,
  Stats,
} from "./types";

// ---------- Reads ----------

export async function getCreators(opts: { fresh?: boolean } = {}): Promise<Creator[]> {
  if (isSampleMode()) return sampleCreators;
  const rows = await listAll(TABLES.creators, {}, opts);
  return rows
    .map((r) => ({
      id: r.id,
      name: str(r.fields[CRF.name]) ?? "Unnamed creator",
      photo: firstAttachment(r.fields[CRF.photo]),
      instagram: cleanHandle(str(r.fields[CRF.instagram])),
      tiktok: cleanHandle(str(r.fields[CRF.tiktok])),
      instagramFollowers: num(r.fields[CRF.instagramFollowers]),
      tiktokFollowers: num(r.fields[CRF.tiktokFollowers]),
      tags: strings(r.fields[CRF.tags]),
      location: str(r.fields[CRF.location]),
      rate: num(r.fields[CRF.rate]) || undefined,
      email: str(r.fields[CRF.email]),
      notes: str(r.fields[CRF.notes]),
      avgViews: num(r.fields[CRF.avgViews]) || undefined,
      statsUpdated: str(r.fields[CRF.statsUpdated]),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCampaigns(opts: { fresh?: boolean } = {}): Promise<Campaign[]> {
  if (isSampleMode()) return sampleCampaigns;
  const rows = await listAll(TABLES.campaigns, {}, opts);
  return rows.map((r) => ({
    id: r.id,
    name: str(r.fields[CF.name]) ?? "Untitled campaign",
    artist: str(r.fields[CF.artist]) ?? "",
    song: str(r.fields[CF.song]),
    startDate: str(r.fields[CF.startDate]),
    endDate: str(r.fields[CF.endDate]),
    budget: num(r.fields[CF.budget]) || undefined,
    status: (str(r.fields[CF.status]) as CampaignStatus) ?? "Planning",
    creatorIds: ids(r.fields[CF.creators]),
    sharingEnabled: r.fields[CF.sharingEnabled] === true,
    stage: toStage(str(r.fields[CF.stage])),
    brief: str(r.fields[CF.brief]),
    showRates: r.fields[CF.showRates] === true,
    type: CAMPAIGN_TYPES.find((t) => t.toLowerCase() === str(r.fields[CF.type])?.toLowerCase()),
    partnerContacts: str(r.fields[CF.partnerContacts]),
  }));
}

function toStage(v?: string): Stage | undefined {
  const s = v?.toLowerCase();
  return s === "creators" || s === "drafts" || s === "live" ? s : undefined;
}

/** Which tab a campaign opens on: the Stage field if set, otherwise inferred from Status. */
export function campaignStage(c: Campaign): Stage {
  return c.stage ?? (c.status === "Planning" ? "creators" : "live");
}

// ---------- Roster (Campaign Creators) and drafts ----------

function mapAssignment(r: AirtableRecord): Assignment {
  return {
    id: r.id,
    campaignId: ids(r.fields[AF.campaign])[0] ?? str(r.fields[AF.campaignRecordId]) ?? "",
    creatorId: ids(r.fields[AF.creator])[0],
    status: (str(r.fields[AF.status]) as AssignmentStatus) ?? "Proposed",
    fee: num(r.fields[AF.fee]) || undefined,
    partnerComment: str(r.fields[AF.partnerComment]),
    reviewedBy: str(r.fields[AF.reviewedBy]),
    reviewedAt: str(r.fields[AF.reviewedAt]),
    paid: r.fields[AF.paid] === true || undefined,
  };
}

export async function getAssignments(campaignId: string, opts: { fresh?: boolean } = {}): Promise<Assignment[]> {
  const [rows, creators] = await Promise.all([
    isSampleMode()
      ? Promise.resolve(sampleAssignments.filter((a) => a.campaignId === campaignId))
      : listAll(TABLES.assignments, { filterByFormula: `{${AF.campaignRecordId}}='${safeId(campaignId)}'` }, opts).then(
          (rs) => rs.map(mapAssignment),
        ),
    getCreators(opts),
  ]);
  const byId = new Map(creators.map((c) => [c.id, c]));
  const order: Record<AssignmentStatus, number> = { Approved: 0, Proposed: 1, "Changes requested": 2, Declined: 3 };
  return rows
    .map((a) => ({ ...a, creator: a.creatorId ? byId.get(a.creatorId) : undefined }))
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] ||
        totalReach(b.creator) - totalReach(a.creator),
    );
}

/** Every campaign's roster entries in one read (for cross-campaign totals like the Partners page). */
export async function getAllAssignments(opts: { fresh?: boolean } = {}): Promise<Assignment[]> {
  if (isSampleMode()) return sampleAssignments;
  return (await listAll(TABLES.assignments, {}, opts)).map(mapAssignment);
}

export async function getAssignment(id: string): Promise<Assignment | undefined> {
  if (isSampleMode()) return sampleAssignments.find((a) => a.id === id);
  const rows = await listAll(TABLES.assignments, { filterByFormula: `RECORD_ID()='${safeId(id)}'` }, { fresh: true });
  return rows[0] ? mapAssignment(rows[0]) : undefined;
}

function mapDraft(r: AirtableRecord): Draft {
  return {
    id: r.id,
    assignmentId: ids(r.fields[DF.assignment])[0],
    campaignId: ids(r.fields[DF.campaign])[0] ?? str(r.fields[DF.campaignRecordId]),
    creatorId: ids(r.fields[DF.creator])[0],
    videoUrl: str(r.fields[DF.videoUrl]),
    caption: str(r.fields[DF.caption]),
    version: num(r.fields[DF.version]) || 1,
    status: (str(r.fields[DF.status]) as DraftStatus) ?? "Pending review",
    partnerComment: str(r.fields[DF.partnerComment]),
    reviewedBy: str(r.fields[DF.reviewedBy]),
    submittedAt: str(r.fields[DF.submittedAt]) ?? r.createdTime,
    reviewedAt: str(r.fields[DF.reviewedAt]),
    submittedBy: str(r.fields[DF.submittedBy]),
    platforms: parsePlatforms(r.fields[DF.platforms]),
  };
}

/** Drafts for a campaign, newest first. */
export async function getDrafts(campaignId: string, opts: { fresh?: boolean } = {}): Promise<Draft[]> {
  const [rows, creators] = await Promise.all([
    isSampleMode()
      ? Promise.resolve(sampleDrafts.filter((d) => d.campaignId === campaignId))
      : listAll(TABLES.drafts, { filterByFormula: `{${DF.campaignRecordId}}='${safeId(campaignId)}'` }, opts).then((rs) =>
          rs.map(mapDraft),
        ),
    getCreators(opts),
  ]);
  const byId = new Map(creators.map((c) => [c.id, c]));
  return rows
    .map((d) => ({ ...d, creator: d.creatorId ? byId.get(d.creatorId) : undefined }))
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}

export async function getDraft(id: string): Promise<Draft | undefined> {
  if (isSampleMode()) return sampleDrafts.find((d) => d.id === id);
  const rows = await listAll(TABLES.drafts, { filterByFormula: `RECORD_ID()='${safeId(id)}'` }, { fresh: true });
  return rows[0] ? mapDraft(rows[0]) : undefined;
}

export const totalReach = (c?: Creator) => (c ? c.instagramFollowers + c.tiktokFollowers : 0);

const safeId = (id: string) => id.replace(/[^A-Za-z0-9]/g, "");

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return (await getCampaigns()).find((c) => c.id === id);
}

export async function getPosts(opts: { fresh?: boolean } = {}): Promise<Post[]> {
  if (isSampleMode()) return samplePosts;
  const rows = await listAll(TABLES.posts, {}, opts);
  return rows
    .map((r): Post | undefined => {
      const url = str(r.fields[PF.url]);
      if (!url) return undefined;
      const platformField = str(r.fields[PF.platform])?.toLowerCase();
      const platform: Platform | undefined =
        platformField === "instagram" || platformField === "tiktok" ? platformField : detectPlatform(url);
      if (!platform) return undefined;
      return {
        id: r.id,
        url,
        platform,
        creatorId: ids(r.fields[PF.creator])[0],
        campaignId: ids(r.fields[PF.campaign])[0],
        postedAt: str(r.fields[PF.postedAt]),
        views: num(r.fields[PF.views]),
        likes: num(r.fields[PF.likes]),
        comments: num(r.fields[PF.comments]),
        shares: num(r.fields[PF.shares]),
        lastRefreshed: str(r.fields[PF.lastRefreshed]),
        refreshNote: str(r.fields[PF.refreshNote]),
        status: str(r.fields[PF.status]) === "Removed" ? "Removed" : "Live",
      };
    })
    .filter((p): p is Post => Boolean(p));
}

export async function getSnapshots(campaignId: string): Promise<Snapshot[]> {
  if (isSampleMode()) return sampleSnapshots.filter((s) => s.campaignId === campaignId);
  // Linked-record formulas compare by primary field, so we filter on a plain-text copy of the ID.
  const rows = await listAll(TABLES.snapshots, {
    filterByFormula: `{${SF.campaignRecordId}}='${campaignId.replace(/'/g, "")}'`,
    "sort[0][field]": SF.capturedAt,
    "sort[0][direction]": "asc",
  });
  return rows
    .map((r) => ({
      id: r.id,
      postId: ids(r.fields[SF.post])[0] ?? "",
      campaignId: ids(r.fields[SF.campaign])[0],
      capturedAt: str(r.fields[SF.capturedAt]) ?? r.createdTime,
      views: num(r.fields[SF.views]),
      likes: num(r.fields[SF.likes]),
      comments: num(r.fields[SF.comments]),
      shares: num(r.fields[SF.shares]),
    }))
    .filter((s) => s.campaignId === campaignId && s.postId);
}

// ---------- Campaign dashboard ----------

export function engagementRate(s: Stats): number {
  return s.views > 0 ? (s.likes + s.comments + s.shares) / s.views : 0;
}

export function sumStats(items: Stats[]): Stats {
  return items.reduce(
    (t, p) => ({
      views: t.views + p.views,
      likes: t.likes + p.likes,
      comments: t.comments + p.comments,
      shares: t.shares + p.shares,
    }),
    { views: 0, likes: 0, comments: 0, shares: 0 },
  );
}

export async function getCampaignSummaries() {
  const [campaigns, posts] = await Promise.all([getCampaigns(), getPosts()]);
  const order: Record<CampaignStatus, number> = { Live: 0, Planning: 1, Wrapped: 2 };
  return campaigns
    .map((campaign) => {
      const cp = posts.filter((p) => p.campaignId === campaign.id && p.status === "Live");
      const totals = sumStats(cp);
      return { campaign, totals, posts: cp.length, engagementRate: engagementRate(totals) };
    })
    .sort(
      (a, b) =>
        (order[a.campaign.status] ?? 3) - (order[b.campaign.status] ?? 3) ||
        (b.campaign.startDate ?? "").localeCompare(a.campaign.startDate ?? ""),
    );
}

export async function getCampaignView(campaign: Campaign): Promise<CampaignView> {
  const [creators, allPosts, snapshots, roster, drafts] = await Promise.all([
    getCreators(),
    getPosts(),
    getSnapshots(campaign.id),
    getAssignments(campaign.id),
    getDrafts(campaign.id),
  ]);
  const feeByCreator = new Map(
    roster.filter((a) => a.status === "Approved" && a.creatorId && a.fee).map((a) => [a.creatorId!, a.fee!]),
  );
  const fees = [...feeByCreator.values()].reduce((t, f) => t + f, 0);
  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const expected = expectedCpm(
    roster
      .filter((a) => a.status === "Approved")
      .map((a) => {
        const c = a.creatorId ? creatorById.get(a.creatorId) : undefined;
        return { cost: a.fee ?? c?.rate, avgViews: c?.avgViews };
      }),
  );
  const byId = new Map(creators.map((c) => [c.id, c]));
  const live = allPosts.filter((p) => p.campaignId === campaign.id && p.status === "Live");
  // A creator's fee covers all their posts on this campaign, so each post carries an equal share.
  const postsByCreator = new Map<string, number>();
  live.forEach((p) => p.creatorId && postsByCreator.set(p.creatorId, (postsByCreator.get(p.creatorId) ?? 0) + 1));
  const approvedCreators = new Set(roster.filter((a) => a.status === "Approved").map((a) => a.creatorId));
  const costOf = (creatorId?: string): CampaignView["posts"][number]["cost"] => {
    if (!creatorId) return undefined;
    const fee = feeByCreator.get(creatorId);
    const rate = approvedCreators.has(creatorId) ? byId.get(creatorId)?.rate : undefined;
    const splitAcross = postsByCreator.get(creatorId) ?? 1;
    if (fee) return { amount: fee / splitAcross, basis: "fee", splitAcross };
    if (rate) return { amount: rate / splitAcross, basis: "rate", splitAcross };
    return undefined;
  };
  const posts = live
    .map((p) => ({ ...p, creator: p.creatorId ? byId.get(p.creatorId) : undefined, cost: costOf(p.creatorId) }))
    .sort((a, b) => b.views - a.views);

  const totals = sumStats(posts);
  const creatorIds = new Set(posts.map((p) => p.creatorId).filter(Boolean));

  const lastRefreshed = posts
    .map((p) => p.lastRefreshed)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);

  return {
    campaign,
    posts,
    totals: {
      ...totals,
      posts: posts.length,
      creators: creatorIds.size,
      engagementRate: engagementRate(totals),
    },
    series: buildSeries(snapshots, posts),
    topCreators: buildCreatorPerformance(posts, feeByCreator),
    lastRefreshed,
    benchmark: benchmarkOf(posts),
    spend: fees ? { amount: fees, basis: "fees" } : campaign.budget ? { amount: campaign.budget, basis: "budget" } : undefined,
    spent: spentSoFar(roster, campaign.budget),
    expected: expected.total ? expected : undefined,
    incoming: incomingPosts(roster, drafts, posts, byId),
  };
}

/** Approved creators' fees, and the part marked paid. */
function spentSoFar(roster: Assignment[], budget?: number): CampaignView["spent"] {
  const approved = roster.filter((a) => a.status === "Approved");
  const paid = approved.filter((a) => a.paid);
  const sum = (list: Assignment[]) => list.reduce((t, a) => t + (a.fee ?? 0), 0);
  return {
    fees: sum(approved),
    paid: sum(paid),
    creators: approved.length,
    paidCreators: paid.length,
    unpriced: approved.filter((a) => !a.fee).length,
    budget,
  };
}

/** Approved creators whose newest draft is approved and who haven't posted on this campaign yet. */
function incomingPosts(roster: Assignment[], drafts: Draft[], posts: Post[], creatorsById: Map<string, Creator>): IncomingPost[] {
  const posted = new Set(posts.map((p) => p.creatorId).filter(Boolean));
  return roster
    .filter((a) => a.status === "Approved" && a.creatorId && !posted.has(a.creatorId))
    .flatMap((a) => {
      const latest = drafts.filter((d) => d.assignmentId === a.id).sort((x, y) => y.version - x.version)[0];
      if (latest?.status !== "Approved") return [];
      return [{ assignmentId: a.id, creator: a.creator ?? creatorsById.get(a.creatorId!), version: latest.version, approvedAt: latest.reviewedAt }];
    })
    .sort((x, y) => (x.approvedAt ?? "").localeCompare(y.approvedAt ?? ""));
}

/**
 * Total campaign views per day, carrying each post's latest known count forward.
 * With only one day of refreshes, each refresh (to the minute) is its own point so the chart
 * fills in straight away. The line starts at zero on the first post date.
 */
function buildSeries(snapshots: Snapshot[], posts: Post[]): SeriesPoint[] {
  const livePostIds = new Set(posts.map((p) => p.id));
  const live = snapshots.filter((s) => livePostIds.has(s.postId));
  const oneDay = new Set(live.map((s) => s.capturedAt.slice(0, 10))).size === 1;
  const bucketOf = (s: Snapshot) => (oneDay ? `${s.capturedAt.slice(0, 16)}:00Z` : s.capturedAt.slice(0, 10));

  const byBucket = new Map<string, Snapshot[]>();
  for (const s of live) byBucket.set(bucketOf(s), [...(byBucket.get(bucketOf(s)) ?? []), s]);
  const latest = new Map<string, number>();
  const series: SeriesPoint[] = [...byBucket.keys()].sort().map((date) => {
    for (const s of byBucket.get(date)!) latest.set(s.postId, Math.max(latest.get(s.postId) ?? 0, s.views));
    let views = 0;
    latest.forEach((v) => (views += v));
    return { date, views };
  });

  // Every post started at zero views, so anchor the line there on the first post date.
  const firstPosted = posts.map((p) => p.postedAt?.slice(0, 10)).filter((d): d is string => Boolean(d)).sort()[0];
  if (series.length && firstPosted && firstPosted < series[0].date) {
    series.unshift({ date: firstPosted, views: 0, estimated: true });
  }
  return series;
}

/** Views on posts whose creator has a usual average, against that average × those posts. */
function benchmarkOf(posts: (Post & { creator?: Creator })[]): Benchmark | undefined {
  const known = posts.filter((p) => p.creator?.avgViews);
  if (!known.length) return undefined;
  return {
    views: known.reduce((t, p) => t + p.views, 0),
    expected: known.reduce((t, p) => t + (p.creator!.avgViews ?? 0), 0),
  };
}

/** Every creator's results across all campaigns (live posts only), keyed by creator ID. Team only. */
export async function getTrackRecords(): Promise<Record<string, TrackRecord>> {
  const [creators, posts] = await Promise.all([getCreators(), getPosts()]);
  const byId = new Map(creators.map((c) => [c.id, c]));
  const out: Record<string, TrackRecord> = {};
  const groups = new Map<string, (Post & { creator?: Creator })[]>();
  for (const p of posts) {
    if (p.status !== "Live" || !p.creatorId) continue;
    groups.set(p.creatorId, [...(groups.get(p.creatorId) ?? []), { ...p, creator: byId.get(p.creatorId) }]);
  }
  groups.forEach((ps, id) => {
    out[id] = {
      campaigns: new Set(ps.map((p) => p.campaignId).filter(Boolean)).size,
      posts: ps.length,
      views: ps.reduce((t, p) => t + p.views, 0),
      benchmark: benchmarkOf(ps),
    };
  });
  return out;
}

function buildCreatorPerformance(
  posts: (Post & { creator?: Creator })[],
  feeByCreator: Map<string, number> = new Map(),
): CreatorPerformance[] {
  const groups = new Map<string, (Post & { creator?: Creator })[]>();
  for (const p of posts) {
    const key = p.creatorId ?? `unassigned:${p.id}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()]
    .map((ps) => {
      const t = sumStats(ps);
      return {
        creator: ps[0].creator,
        creatorId: ps[0].creatorId,
        platforms: [...new Set(ps.map((p) => p.platform))],
        posts: ps.length,
        views: t.views,
        engagementRate: engagementRate(t),
        benchmark: benchmarkOf(ps),
        fee: ps[0].creatorId ? feeByCreator.get(ps[0].creatorId) : undefined,
      };
    })
    .sort((a, b) => b.views - a.views);
}

function cleanHandle(h?: string) {
  return h?.replace(/^@/, "").replace(/^https?:\/\/[^/]+\/@?/, "").replace(/\/$/, "") || undefined;
}
