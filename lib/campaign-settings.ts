// Display switches the team sets per campaign, kept as one small JSON file per campaign on the hub's disk.
// Server-side only.
import { readJson, writeJson } from "./storage";

export interface CampaignSettings {
  /**
   * Current CPM (spend ÷ views so far) runs high early in a campaign, before views catch up, so the team
   * can hide it until it means something. Hidden everywhere: team page, partner link and wrap report.
   */
  showCurrentCpm: boolean;
}

const DEFAULTS: CampaignSettings = { showCurrentCpm: true };

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
