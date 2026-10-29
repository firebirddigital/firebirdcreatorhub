// Daily Spotify streams for a campaign's song, from a Spotify for Artists CSV export.
// Stored as a small JSON file per campaign in the private Blob store (confidential: never public).
// Server-side only.
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import { privateBlobToken } from "./blob";
import type { StreamDay } from "./streams-lift";

export type { StreamDay } from "./streams-lift";

export interface CampaignStreams {
  days: StreamDay[];
  song?: string;
  uploadedAt: string;
  /** Off by default: partners only see streams when the team switches this on. */
  shareWithPartner: boolean;
}

const path = (campaignId: string) => `streams/${campaignId.replace(/[^A-Za-z0-9]/g, "")}.json`;

export async function getStreams(campaignId: string): Promise<CampaignStreams | undefined> {
  const token = privateBlobToken();
  if (!token) return undefined;
  try {
    const res = await get(path(campaignId), { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200) return undefined;
    return JSON.parse(await new Response(res.stream).text()) as CampaignStreams;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return undefined;
    throw e;
  }
}

async function save(campaignId: string, data: CampaignStreams) {
  const token = privateBlobToken();
  if (!token) throw new Error("Private storage isn't set up.");
  await put(path(campaignId), JSON.stringify(data), {
    access: "private",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** Adds days from a new upload; a day that's in both keeps the new number. */
export async function mergeStreams(campaignId: string, days: StreamDay[], song?: string) {
  const current = await getStreams(campaignId);
  const byDate = new Map((current?.days ?? []).map((d) => [d.date, d.streams]));
  days.forEach((d) => byDate.set(d.date, d.streams));
  const merged = [...byDate.entries()].map(([date, streams]) => ({ date, streams })).sort((a, b) => a.date.localeCompare(b.date));
  const data: CampaignStreams = {
    days: merged,
    song: song?.trim() || current?.song,
    uploadedAt: new Date().toISOString(),
    shareWithPartner: current?.shareWithPartner ?? false,
  };
  await save(campaignId, data);
  return data;
}

export async function setStreamsSharing(campaignId: string, shareWithPartner: boolean) {
  const current = await getStreams(campaignId);
  if (!current) throw new Error("Upload streams first.");
  await save(campaignId, { ...current, shareWithPartner });
}

/** Removes a campaign's saved streams (for a wrong upload). */
export async function removeStreams(campaignId: string) {
  const token = privateBlobToken();
  if (!token) return;
  await del(path(campaignId), { token }).catch(() => undefined);
}
