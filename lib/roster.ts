// Writes for the Creators → Drafts → Live workflow. Server-side only.
import { createRecords, updateRecords } from "./airtable";
import { fetchProfileStats } from "./apify";
import {
  ASSIGNMENT_FIELDS as AF,
  CAMPAIGN_FIELDS as CF,
  CREATOR_FIELDS as CRF,
  DRAFT_FIELDS as DF,
  TABLES,
} from "./config";
import { getAssignments, getCampaign, getCreators, getDrafts } from "./data";
import type { Assignment, AssignmentStatus, DraftStatus, Platform, Stage } from "./types";

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

export async function updateAssignment(id: string, patch: { status?: AssignmentStatus; fee?: number | null }) {
  const fields: Record<string, unknown> = {};
  if (patch.status) fields[AF.status] = patch.status;
  if (patch.fee !== undefined) fields[AF.fee] = patch.fee;
  await updateRecords(TABLES.assignments, [{ id, fields }]);
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
    reviewedBy: opts.reviewer?.trim().slice(0, 80) || "Partner",
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

/** Saves a creator's uploaded draft as the next version. */
export async function createDraft(assignment: Assignment, videoUrl: string, caption?: string) {
  const [campaign, drafts, creators] = await Promise.all([
    getCampaign(assignment.campaignId),
    getDrafts(assignment.campaignId, { fresh: true }),
    getCreators(),
  ]);
  const version = drafts.filter((d) => d.assignmentId === assignment.id).length + 1;
  const name = creators.find((c) => c.id === assignment.creatorId)?.name ?? "Creator";
  await createRecords(TABLES.drafts, [
    {
      fields: {
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
      },
    },
  ]);
  return version;
}

/**
 * Pulls followers and average views for creators from their recent posts.
 * Average views blends both platforms' recent videos.
 */
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
      const totalVideos = (tt?.videos ?? 0) + (ig?.videos ?? 0);
      const avg = totalVideos
        ? Math.round(((tt?.avgViews ?? 0) * (tt?.videos ?? 0) + (ig?.avgViews ?? 0) * (ig?.videos ?? 0)) / totalVideos)
        : undefined;
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
