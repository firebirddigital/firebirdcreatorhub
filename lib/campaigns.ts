// Create and edit campaigns from the hub. Server-side only.
import { createRecords, deleteRecords, updateRecords } from "./airtable";
import { getAssignments, getDrafts, getPosts, getSnapshots } from "./data";
import { removeCampaignFromFolders } from "./folders";
import { CAMPAIGN_FIELDS as CF, TABLES } from "./config";
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, type CampaignStatus, type CampaignType, type Stage } from "./types";

export interface CampaignInput {
  name?: string;
  artist?: string;
  song?: string;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  status?: CampaignStatus;
  stage?: Stage;
  brief?: string;
  briefUrl?: string;
  sharingEnabled?: boolean;
  showRates?: boolean;
  type?: CampaignType;
}

const STAGE_LABEL: Record<Stage, string> = { creators: "Creators", drafts: "Drafts", live: "Live" };
const isDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);

/** Turns untrusted form input into Airtable fields, dropping anything invalid. */
export function toFields(input: Record<string, unknown>): { fields: Record<string, unknown>; error?: string } {
  const f: Record<string, unknown> = {};
  if ("name" in input) {
    const name = text(input.name, 120);
    if (!name) return { fields: f, error: "Give the campaign a name." };
    f[CF.name] = name;
  }
  if ("artist" in input) f[CF.artist] = text(input.artist, 120) ?? "";
  if ("song" in input) f[CF.song] = text(input.song, 120) ?? "";
  if ("brief" in input) f[CF.brief] = text(input.brief, 10_000) ?? "";
  if ("briefUrl" in input) {
    const url = text(input.briefUrl, 2_000) ?? "";
    if (url && !/^https?:\/\/\S+$/i.test(url)) return { fields: f, error: "The brief link should start with https://" };
    f[CF.briefUrl] = url || null;
  }
  for (const [key, field] of [
    ["startDate", CF.startDate],
    ["endDate", CF.endDate],
  ] as const) {
    if (key in input) f[field] = isDate(input[key]) ? input[key] : null;
  }
  if ("budget" in input) {
    const b = input.budget;
    f[CF.budget] = typeof b === "number" && isFinite(b) && b >= 0 ? Math.round(b) : null;
  }
  if ("status" in input && CAMPAIGN_STATUSES.includes(input.status as CampaignStatus)) f[CF.status] = input.status;
  if ("stage" in input && typeof input.stage === "string" && input.stage in STAGE_LABEL) {
    f[CF.stage] = STAGE_LABEL[input.stage as Stage];
  }
  if ("sharingEnabled" in input) f[CF.sharingEnabled] = input.sharingEnabled === true;
  if ("showRates" in input) f[CF.showRates] = input.showRates === true;
  if ("type" in input && CAMPAIGN_TYPES.includes(input.type as CampaignType)) f[CF.type] = input.type;
  if (isDate(f[CF.startDate]) && isDate(f[CF.endDate]) && (f[CF.endDate] as string) < (f[CF.startDate] as string)) {
    return { fields: f, error: "The end date is before the start date." };
  }
  return { fields: f };
}

// Fields the team may not have added to Airtable yet. A write that names one of these and fails with
// UNKNOWN_FIELD_NAME is retried without it, and the caller is told which were skipped.
const OPTIONAL_FIELDS = [CF.type, CF.briefUrl];

async function withoutMissingFields<T>(fields: Record<string, unknown>, write: (f: Record<string, unknown>) => Promise<T>) {
  const skipped: string[] = [];
  let current = { ...fields };
  for (;;) {
    try {
      return { result: await write(current), skipped };
    } catch (e) {
      const msg = String(e);
      const missing = OPTIONAL_FIELDS.find((name) => name in current && msg.includes("UNKNOWN_FIELD_NAME") && msg.includes(name));
      if (!missing) throw e;
      const { [missing]: _drop, ...rest } = current;
      current = rest;
      skipped.push(missing);
    }
  }
}

export async function updateCampaign(id: string, fields: Record<string, unknown>) {
  const { skipped } = await withoutMissingFields(fields, (f) => updateRecords(TABLES.campaigns, [{ id, fields: f }]));
  return { typeSaved: CF.type in fields && !skipped.includes(CF.type), skipped };
}

export async function createCampaign(fields: Record<string, unknown>): Promise<{ id: string; typeSaved: boolean; skipped: string[] }> {
  const { result, skipped } = await withoutMissingFields(
    { [CF.status]: "Awaiting approval", [CF.stage]: "Creators", ...fields },
    (f) => createRecords(TABLES.campaigns, [{ fields: f }]),
  );
  return { id: result[0].id, typeSaved: CF.type in fields && !skipped.includes(CF.type), skipped };
}

/**
 * Deletes a campaign and everything that belongs to it in Airtable: its roster, drafts, live posts and
 * their stats history. Airtable keeps deleted records in the base's trash for a limited time.
 */
export async function deleteCampaign(id: string): Promise<{ assignments: number; drafts: number; posts: number; snapshots: number }> {
  const [roster, drafts, posts, snapshots] = await Promise.all([
    getAssignments(id, { fresh: true }),
    getDrafts(id, { fresh: true }),
    getPosts({ fresh: true }).then((all) => all.filter((p) => p.campaignId === id)),
    getSnapshots(id),
  ]);
  // Children first, so a failure part-way never leaves records pointing at a campaign that's gone.
  await deleteRecords(TABLES.snapshots, snapshots.map((s) => s.id));
  await deleteRecords(TABLES.posts, posts.map((p) => p.id));
  await deleteRecords(TABLES.drafts, drafts.map((d) => d.id));
  await deleteRecords(TABLES.assignments, roster.map((a) => a.id));
  await deleteRecords(TABLES.campaigns, [id]);
  await removeCampaignFromFolders(id);
  return { assignments: roster.length, drafts: drafts.length, posts: posts.length, snapshots: snapshots.length };
}
