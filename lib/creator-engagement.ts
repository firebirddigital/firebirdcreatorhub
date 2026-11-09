// Each creator's engagement rate across their last 10 posts, kept in one JSON file on the hub's disk.
// Filled in by the same stats pull as median views (every 14 days, oldest first). Lives on disk rather
// than in Airtable because the hub's Airtable key can't add columns. Server-side only.
import { readJson, writeJson } from "./storage";

export interface CreatorEngagement {
  /** (Likes + comments + shares) ÷ views, across the posts counted. */
  rate: number;
  /** Posts counted (posts with hidden likes or no views are left out). */
  posts: number;
  updatedAt: string;
}

const FILE = "creator-engagement.json";

export async function getEngagement(): Promise<Record<string, CreatorEngagement>> {
  return (await readJson<Record<string, CreatorEngagement>>(FILE).catch(() => undefined)) ?? {};
}

export async function saveEngagement(entries: Record<string, CreatorEngagement>) {
  if (!Object.keys(entries).length) return;
  await writeJson(FILE, { ...(await getEngagement()), ...entries });
}
