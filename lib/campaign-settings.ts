// Display switches the team sets per campaign, kept as one small JSON file per campaign on the hub's disk.
// Server-side only.
import { readJson, writeJson } from "./storage";
import type { CampaignType } from "./types";

export interface CampaignSettings {
  /**
   * Current CPM (spend ÷ views so far) runs high early in a campaign, before views catch up, so the team
   * can hide it until it means something. Hidden everywhere: team page, partner link and wrap report.
   */
  showCurrentCpm: boolean;
  /**
   * Creators' engagement rate (last 10 posts) on the partner link and wrap report. The team always sees it.
   * Off until the team turns it on, so nothing new reaches partners unasked.
   */
  showEngagementToPartners: boolean;
}

const DEFAULTS: CampaignSettings = { showCurrentCpm: true, showEngagementToPartners: false };

const path = (campaignId: string) => `campaign-settings/${campaignId.replace(/[^A-Za-z0-9]/g, "")}.json`;

export async function getCampaignSettings(campaignId: string): Promise<CampaignSettings> {
  const saved = await readJson<Partial<CampaignSettings>>(path(campaignId)).catch(() => undefined);
  return { ...DEFAULTS, ...saved };
}

export async function updateCampaignSettings(campaignId: string, change: Partial<CampaignSettings>) {
  const next = { ...(await getCampaignSettings(campaignId)), ...change };
  await writeJson(path(campaignId), next);
  return next;
}

// Each campaign's Type (Influencer or Content Seeding), kept here too because the Campaigns table may not
// have a Type field yet. Airtable's value wins when it has one.
const TYPES = "campaign-types.json";

export async function getSavedTypes(): Promise<Record<string, CampaignType>> {
  return (await readJson<Record<string, CampaignType>>(TYPES).catch(() => undefined)) ?? {};
}

export async function saveCampaignType(campaignId: string, type: CampaignType) {
  await writeJson(TYPES, { ...(await getSavedTypes()), [campaignId]: type });
}
