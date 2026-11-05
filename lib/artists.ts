// Artists for the campaigns list's Artist filter. Most come from the campaigns themselves; the team can
// also add an artist by hand before they have a campaign. Those are kept in one small JSON file on the
// hub's disk. Server-side only.
import { readJson, writeJson } from "./storage";

const PATH = "campaigns/artists.json";

export const cleanArtistName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 120) : "");
const key = (name: string) => name.toLowerCase();

/** Artists the team added by hand. */
export async function getManualArtists(): Promise<string[]> {
  const data = await readJson<{ names?: unknown }>(PATH);
  return Array.isArray(data?.names) ? data.names.filter((n): n is string => typeof n === "string") : [];
}

export async function setManualArtist(name: string, present: boolean): Promise<string[]> {
  const others = (await getManualArtists()).filter((n) => key(n) !== key(name));
  const names = (present ? [...others, name] : others).sort((a, b) => a.localeCompare(b));
  await writeJson(PATH, { names, updatedAt: new Date().toISOString() });
  return names;
}

/** Every artist name for the filter: from campaigns, plus hand-added ones, deduplicated ignoring case. */
export function artistOptions(fromCampaigns: string[], manual: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const n of [...fromCampaigns, ...manual]) {
    const name = n.trim();
    if (name && !byKey.has(key(name))) byKey.set(key(name), name);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}
