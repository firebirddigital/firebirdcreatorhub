// Writes for the Creators → Drafts → Live workflow. Server-side only.
import { createRecords, deleteRecords, updateRecords } from "./airtable";
import { fetchProfileStats, latest, type ProfileStats } from "./apify";
import { median } from "./format";
import {
  ASSIGNMENT_FIELDS as AF,
  CAMPAIGN_FIELDS as CF,
  CREATOR_FIELDS as CRF,
  DRAFT_FIELDS as DF,
  TABLES,
} from "./config";
import { getAssignments, getCampaign, getCreators, getDrafts } from "./data";
import type { Assignment, AssignmentStatus, DraftPlatform, DraftStatus, Platform, Stage } from "./types";

const STAGE_LABEL: Record<Stage, string> = { creators: "Creators", drafts: "Drafts", live: "Live" };

export async function setStage(campaignId: string, stage: Stage) {
  await updateRecords(TABLES.campaigns, [{ id: campaignId, fields: { [CF.stage]: STAGE_LABEL[stage] } }]);
}

/**
 * Adds creators to a campaign's roster (skipping anyone already on it) and keeps the
 * campaign's own Creators link in sync. Returns how many were added.
 */
export async function addCreatorsToCampaign(
  campaignId: string,
  creatorIds: string[],
  status: AssignmentStatus = "Proposed",
  reviewedBy?: string,
): Promise<number> {
  const [campaign, existing, creators] = await Promise.all([
    getCampaign(campaignId),
    getAssignments(campaignId, { fresh: true }),
    getCreators({ fresh: true }),
  ]);
  if (!campaign) throw new Error("Campaign not found");
  const already = new Set(existing.map((a) => a.creatorId));
  const toAdd = [...new Set(creatorIds)].filter((id) => !already.has(id));
  if (!toAdd.length) return 0;

  const byId = new Map(creators.map((c) => [c.id, c]));
  await createRecords(
    TABLES.assignments,
    toAdd.map((creatorId) => ({
      fields: {
        [AF.label]: `${byId.get(creatorId)?.name ?? "Creator"} for ${campaign.name}`,
        [AF.campaign]: [campaignId],
        [AF.campaignRecordId]: campaignId,
        [AF.creator]: [creatorId],
        [AF.status]: status,
        ...(reviewedBy ? { [AF.reviewedBy]: reviewedBy, [AF.reviewedAt]: new Date().toISOString() } : {}),
        ...(byId.get(creatorId)?.rate ? { [AF.fee]: byId.get(creatorId)!.rate } : {}),
      },
    })),
  );

  const merged = [...new Set([...campaign.creatorIds, ...toAdd])];
  if (merged.length > campaign.creatorIds.length) {
    await updateRecords(TABLES.campaigns, [{ id: campaignId, fields: { [CF.creators]: merged } }]);
  }
  return toAdd.length;
}

/**
 * Takes creators off a campaign: deletes their roster entries and unlinks them from the campaign.
 * The creators stay in the Creators database; their posts and drafts aren't touched.
 */
export async function removeFromCampaign(campaignId: string, assignmentIds: string[]): Promise<number> {
  const [campaign, roster] = await Promise.all([getCampaign(campaignId), getAssignments(campaignId, { fresh: true })]);
  if (!campaign) throw new UserError("Campaign not found.");
  const wanted = new Set(assignmentIds);
  const removing = roster.filter((a) => wanted.has(a.id));
  if (!removing.length) return 0;
  await deleteRecords(TABLES.assignments, removing.map((a) => a.id));
  const gone = new Set(removing.map((a) => a.creatorId).filter(Boolean));
  const remaining = campaign.creatorIds.filter((id) => !gone.has(id));
  if (remaining.length !== campaign.creatorIds.length) {
    await updateRecords(TABLES.campaigns, [{ id: campaignId, fields: { [CF.creators]: remaining } }]);
  }
  return removing.length;
}

export async function updateAssignment(id: string, patch: { status?: AssignmentStatus; fee?: number | null; paid?: boolean }) {
  const fields: Record<string, unknown> = {};
  if (patch.status) fields[AF.status] = patch.status;
  if (patch.fee !== undefined) fields[AF.fee] = patch.fee;
  if (patch.paid !== undefined) fields[AF.paid] = patch.paid;
  try {
    await updateRecords(TABLES.assignments, [{ id, fields }]);
  } catch (e) {
    // Paid is an optional field the team adds in Airtable.
    if (patch.paid !== undefined && String(e).includes("UNKNOWN_FIELD_NAME")) {
      throw new UserError(`Add a checkbox field called “${AF.paid}” to the ${TABLES.assignments} table in Airtable, then try again.`);
    }
    throw e;
  }
}

const DECISIONS = {
  approve: { creator: "Approved", draft: "Approved" },
  changes: { creator: "Changes requested", draft: "Changes requested" },
  decline: { creator: "Declined", draft: "Changes requested" },
} as const;

export type Decision = keyof typeof DECISIONS;

/** Records a partner decision on a proposed creator or a draft. */
export async function recordReview(opts: {
  kind: "creator" | "draft";
  recordId: string;
  decision: Decision;
  comment?: string;
  reviewer?: string;
}) {
  const now = new Date().toISOString();
  const common = {
    reviewedBy: opts.reviewer?.trim().slice(0, 200) || "Partner",
    comment: opts.comment?.trim().slice(0, 2000) ?? "",
  };
  if (opts.kind === "creator") {
    await updateRecords(TABLES.assignments, [
      {
        id: opts.recordId,
        fields: {
          [AF.status]: DECISIONS[opts.decision].creator as AssignmentStatus,
          [AF.partnerComment]: common.comment,
          [AF.reviewedBy]: common.reviewedBy,
          [AF.reviewedAt]: now,
        },
      },
    ]);
  } else {
    await updateRecords(TABLES.drafts, [
      {
        id: opts.recordId,
        fields: {
          [DF.status]: DECISIONS[opts.decision].draft as DraftStatus,
          [DF.partnerComment]: common.comment,
          [DF.reviewedBy]: common.reviewedBy,
          [DF.reviewedAt]: now,
        },
      },
    ]);
  }
}

/** Saves a draft (an uploaded file or a link) as the creator's next version. */
export async function createDraft(
  assignment: Assignment,
  videoUrl: string,
  caption?: string,
  submittedBy?: string,
  platforms: DraftPlatform[] = [],
) {
  const [campaign, drafts, creators] = await Promise.all([
    getCampaign(assignment.campaignId),
    getDrafts(assignment.campaignId, { fresh: true }),
    getCreators(),
  ]);
  const version = drafts.filter((d) => d.assignmentId === assignment.id).length + 1;
  const name = creators.find((c) => c.id === assignment.creatorId)?.name ?? "Creator";
  const fields: Record<string, unknown> = {
    [DF.label]: `${name} v${version}${campaign ? ` for ${campaign.name}` : ""}`,
    [DF.assignment]: [assignment.id],
    [DF.campaign]: [assignment.campaignId],
    [DF.campaignRecordId]: assignment.campaignId,
    ...(assignment.creatorId ? { [DF.creator]: [assignment.creatorId] } : {}),
    [DF.videoUrl]: videoUrl,
    [DF.caption]: caption?.trim().slice(0, 2200) ?? "",
    [DF.version]: version,
    [DF.status]: "Pending review",
    [DF.submittedAt]: new Date().toISOString(),
  };
  const optional: Record<string, unknown> = {
    ...(submittedBy ? { [DF.submittedBy]: submittedBy } : {}),
    ...(platforms.length ? { [DF.platforms]: platforms.join(", ") } : {}),
  };
  try {
    await createRecords(TABLES.drafts, [{ fields: { ...fields, ...optional } }]);
  } catch (e) {
    // Submitted By and Platforms are optional in Airtable; save without them if the base doesn't have them.
    const err = String(e);
    if (!Object.keys(optional).length || !err.includes("UNKNOWN_FIELD_NAME")) throw e;
    // Drop the missing field(s) Airtable names, or all optional ones if it doesn't say.
    const missing = Object.keys(optional).filter((k) => err.includes(`"${k}"`));
    const kept = Object.fromEntries(Object.entries(optional).filter(([k]) => missing.length && !missing.includes(k)));
    await createRecords(TABLES.drafts, [{ fields: { ...fields, ...kept } }]);
    return { version, platformsSaved: !platforms.length || DF.platforms in kept };
  }
  return { version, platformsSaved: true };
}

/**
 * Finds or creates the creator's roster entry so the team can add a draft even when the
 * Creators step was skipped. New entries are Approved and marked as added by the team.
 * Partner decisions are respected: a declined or sent-back creator isn't silently re-approved.
 */
export async function ensureDraftAssignment(
  campaignId: string,
  who: { assignmentId?: string; creatorId?: string; newCreator?: { name: string; instagram?: string; tiktok?: string } },
): Promise<{ assignment: Assignment; createdCreator: boolean; addedToCampaign: boolean }> {
  const TEAM_NOTE = "Firebird team (added with a draft)";

  if (who.assignmentId) {
    const a = (await getAssignments(campaignId, { fresh: true })).find((x) => x.id === who.assignmentId);
    if (!a) throw new UserError("That creator isn't on this campaign.");
    return { assignment: await approveForDraft(a, TEAM_NOTE), createdCreator: false, addedToCampaign: false };
  }

  let creatorId = who.creatorId;
  let createdCreator = false;
  if (!creatorId && who.newCreator) {
    const found = await findOrCreateCreator(who.newCreator, "Added by the team with a draft.");
    creatorId = found.id;
    createdCreator = found.created;
  }
  if (!creatorId) throw new UserError("Pick a creator or add a new one.");

  const existing = (await getAssignments(campaignId, { fresh: true })).find((a) => a.creatorId === creatorId);
  if (existing) return { assignment: await approveForDraft(existing, TEAM_NOTE), createdCreator, addedToCampaign: false };

  await addCreatorsToCampaign(campaignId, [creatorId], "Approved", TEAM_NOTE);
  const added = (await getAssignments(campaignId, { fresh: true })).find((a) => a.creatorId === creatorId);
  if (!added) throw new Error("Couldn't add that creator to the campaign. Try again.");
  return { assignment: added, createdCreator, addedToCampaign: true };
}

async function approveForDraft(a: Assignment, note: string): Promise<Assignment> {
  if (a.status === "Approved") return a;
  if (a.status !== "Proposed") {
    throw new UserError(
      `The partner marked this creator “${a.status}”. Change their status on the Creators tab first if you still want to add a draft.`,
    );
  }
  await updateRecords(TABLES.assignments, [
    { id: a.id, fields: { [AF.status]: "Approved", [AF.reviewedBy]: note, [AF.reviewedAt]: new Date().toISOString() } },
  ]);
  return { ...a, status: "Approved", reviewedBy: note };
}

/** An error whose message is safe and useful to show the team. */
export class UserError extends Error {}

export interface NewCreatorInput {
  name: string;
  instagram?: string;
  tiktok?: string;
  tags?: string[];
  rate?: number;
  email?: string;
  location?: string;
  /** From a profile link lookup, so new creators arrive with stats. */
  instagramFollowers?: number;
  tiktokFollowers?: number;
  avgViews?: number;
}

/**
 * Adds a creator to the roster, or reuses the one that already has the same Instagram or TikTok
 * handle so nobody ends up in the database twice. New tags are added to a matched creator too.
 */
export async function findOrCreateCreator(
  input: NewCreatorInput,
  note: string,
): Promise<{ id: string; created: boolean; name: string }> {
  const name = input.name.trim().slice(0, 100);
  const instagram = cleanHandle(input.instagram);
  const tiktok = cleanHandle(input.tiktok);
  if (!name) throw new UserError("Add the creator's name.");
  const tags = [...new Set((input.tags ?? []).map((t) => t.trim().replace(/,/g, "").slice(0, 50)).filter(Boolean))].slice(0, 30);
  const email = input.email?.trim().slice(0, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("That email doesn't look right.");

  const roster = await getCreators({ fresh: true });
  const match = roster.find(
    (c) =>
      (instagram && c.instagram?.toLowerCase() === instagram.toLowerCase()) ||
      (tiktok && c.tiktok?.toLowerCase() === tiktok.toLowerCase()) ||
      // No handles to go on: fall back to an exact name match.
      (!instagram && !tiktok && c.name.toLowerCase() === name.toLowerCase()),
  );
  const count = (v?: number) => (typeof v === "number" && isFinite(v) && v > 0 ? Math.round(v) : undefined);
  const stats = (
    [
      [CRF.instagramFollowers, instagram ? count(input.instagramFollowers) : undefined],
      [CRF.tiktokFollowers, tiktok ? count(input.tiktokFollowers) : undefined],
      [CRF.avgViews, count(input.avgViews)],
    ] as [string, number | undefined][]
  ).filter((e): e is [string, number] => e[1] !== undefined);

  if (match) {
    // Add new tags, and fill in stats the existing record is missing (never overwrite ones it has).
    const missing = tags.filter((t) => !match.tags.includes(t));
    const current: Record<string, number | undefined> = {
      [CRF.instagramFollowers]: match.instagramFollowers,
      [CRF.tiktokFollowers]: match.tiktokFollowers,
      [CRF.avgViews]: match.avgViews,
    };
    const blanks = stats.filter(([field]) => !current[field]);
    const fields: Record<string, unknown> = {
      ...(missing.length ? { [CRF.tags]: [...match.tags, ...missing] } : {}),
      ...(blanks.length ? Object.fromEntries([...blanks, [CRF.statsUpdated, new Date().toISOString()]]) : {}),
    };
    if (Object.keys(fields).length) await updateRecords(TABLES.creators, [{ id: match.id, fields }]);
    return { id: match.id, created: false, name: match.name };
  }

  const [rec] = await createRecords(TABLES.creators, [
    {
      fields: {
        [CRF.name]: name,
        ...(instagram ? { [CRF.instagram]: instagram } : {}),
        ...(tiktok ? { [CRF.tiktok]: tiktok } : {}),
        ...(tags.length ? { [CRF.tags]: tags } : {}),
        ...(input.rate && input.rate > 0 ? { [CRF.rate]: Math.round(input.rate) } : {}),
        ...(email ? { [CRF.email]: email } : {}),
        ...(input.location?.trim() ? { [CRF.location]: input.location.trim().slice(0, 100) } : {}),
        ...(stats.length ? Object.fromEntries([...stats, [CRF.statsUpdated, new Date().toISOString()]]) : {}),
        [CRF.notes]: `${note}${tags.length ? "" : " Add tags."}`,
      },
    },
  ]);
  return { id: rec.id, created: true, name };
}

export function cleanHandle(h?: string) {
  return h?.trim().replace(/^@/, "").replace(/^https?:\/\/[^/]+\/@?/, "").replace(/[/?#].*$/, "") || undefined;
}

/** Median views across a creator's last 10 posts, taking the newest across TikTok and Instagram together. */
export function combinedAvgViews(...platforms: (ProfileStats | undefined)[]): number | undefined {
  return median(latest(platforms.flatMap((p) => p?.recent ?? [])).map((p) => p.views));
}

/**
 * Pulls followers and average views (last 10 posts) for creators.
 * Creators on both platforms get their 10 newest posts across both.
 */
/**
 * Pulls stats for any of these creators who have never had them (about $0.03 of Apify credit each), so
 * median views and CPM fill in as soon as a creator joins a campaign or sends a draft. Safe to call often:
 * creators who already have stats are skipped.
 */
export async function pullMissingStats(creatorIds: string[]) {
  if (!process.env.APIFY_TOKEN || !creatorIds.length) return;
  const missing = (await getCreators({ fresh: true }))
    .filter((c) => creatorIds.includes(c.id) && !c.statsUpdated && !c.avgViews && (c.tiktok || c.instagram))
    .map((c) => c.id);
  if (missing.length) await refreshCreatorStats(missing);
}

export async function refreshCreatorStats(creatorIds: string[]) {
  const creators = (await getCreators({ fresh: true })).filter((c) => creatorIds.includes(c.id));
  const accounts: { platform: Platform; handle: string }[] = [];
  for (const c of creators) {
    if (c.tiktok) accounts.push({ platform: "tiktok", handle: c.tiktok });
    if (c.instagram) accounts.push({ platform: "instagram", handle: c.instagram });
  }
  const stats = await fetchProfileStats(accounts);
  const now = new Date().toISOString();

  const updates = creators
    .map((c) => {
      const tt = c.tiktok ? stats.get(`tiktok:${c.tiktok.toLowerCase()}`) : undefined;
      const ig = c.instagram ? stats.get(`instagram:${c.instagram.toLowerCase()}`) : undefined;
      if (!tt && !ig) return undefined;
      const avg = combinedAvgViews(tt, ig);
      const fields: Record<string, unknown> = { [CRF.statsUpdated]: now };
      if (tt?.followers) fields[CRF.tiktokFollowers] = tt.followers;
      if (ig?.followers) fields[CRF.instagramFollowers] = ig.followers;
      if (avg) fields[CRF.avgViews] = avg;
      return { id: c.id, fields };
    })
    .filter((u): u is { id: string; fields: Record<string, unknown> } => Boolean(u));

  if (updates.length) await updateRecords(TABLES.creators, updates);
  return { requested: creators.length, updated: updates.length };
}
