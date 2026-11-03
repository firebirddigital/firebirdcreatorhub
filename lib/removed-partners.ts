// Partners the team has removed from Analytics (for example, internal or test entries in the roster).
// Stored as one small JSON file on the hub's disk, so a removal can be undone. Server-side only.
import { readJson, writeJson } from "./storage";

const PATH = "analytics/removed-partners.json";

export async function getRemovedPartners(): Promise<string[]> {
  const data = await readJson<{ names?: unknown }>(PATH);
  return Array.isArray(data?.names) ? data.names.filter((n): n is string => typeof n === "string") : [];
}

export async function setPartnerRemoved(name: string, removed: boolean): Promise<string[]> {
  const current = await getRemovedPartners();
  const others = current.filter((n) => n.toLowerCase() !== name.toLowerCase());
  const names = (removed ? [...others, name] : others).sort((a, b) => a.localeCompare(b));
  await writeJson(PATH, { names, updatedAt: new Date().toISOString() });
  return names;
}
