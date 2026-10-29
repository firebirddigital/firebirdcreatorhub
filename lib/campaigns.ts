// Create and edit campaigns from the hub. Server-side only.
import { createRecords, updateRecords } from "./airtable";
import { CAMPAIGN_FIELDS as CF, TABLES } from "./config";
import { CAMPAIGN_TYPES, type CampaignStatus, type CampaignType, type Stage } from "./types";

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
  sharingEnabled?: boolean;
  showRates?: boolean;
  type?: CampaignType;
}

const STATUSES: CampaignStatus[] = ["Planning", "Live", "Wrapped"];
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
  if ("status" in input && STATUSES.includes(input.status as CampaignStatus)) f[CF.status] = input.status;
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

/**
 * Type is optional in Airtable. If the base doesn't have the field yet, save everything else
 * and report typeSaved: false so the team knows to add it.
 */
async function withoutMissingType<T>(fields: Record<string, unknown>, write: (f: Record<string, unknown>) => Promise<T>) {
  try {
    return { result: await write(fields), typeSaved: CF.type in fields };
  } catch (e) {
    if (!(CF.type in fields) || !String(e).includes("UNKNOWN_FIELD_NAME")) throw e;
    const { [CF.type]: _type, ...rest } = fields;
    return { result: await write(rest), typeSaved: false };
  }
}

export async function updateCampaign(id: string, fields: Record<string, unknown>) {
  const { typeSaved } = await withoutMissingType(fields, (f) => updateRecords(TABLES.campaigns, [{ id, fields: f }]));
  return { typeSaved };
}

export async function createCampaign(fields: Record<string, unknown>): Promise<{ id: string; typeSaved: boolean }> {
  const { result, typeSaved } = await withoutMissingType(
    { [CF.status]: "Planning", [CF.stage]: "Creators", ...fields },
    (f) => createRecords(TABLES.campaigns, [{ fields: f }]),
  );
  return { id: result[0].id, typeSaved };
}
