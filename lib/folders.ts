// Campaign folders: named groups of campaigns (Influencer and Content Seeding alike) with one share link.
// Stored as one small JSON file on the hub's disk, like the removed-partners list. Server-side only.
import { randomBytes } from "node:crypto";
import { readJson, writeJson } from "./storage";

const PATH = "campaigns/folders.json";

export interface Folder {
  id: string;
  name: string;
  campaignIds: string[];
  createdAt: string;
  updatedAt: string;
}

const isFolder = (f: unknown): f is Folder => {
  const x = f as Folder;
  return Boolean(x) && typeof x.id === "string" && typeof x.name === "string" && Array.isArray(x.campaignIds);
};

async function readAll(): Promise<Folder[]> {
  const data = await readJson<{ folders?: unknown[] }>(PATH);
  return (data?.folders ?? []).filter(isFolder);
}

async function writeAll(folders: Folder[]) {
  await writeJson(PATH, { folders });
}

/** Every folder, most recently updated first. */
export async function getFolders(): Promise<Folder[]> {
  return (await readAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getFolder(id: string): Promise<Folder | undefined> {
  return (await readAll()).find((f) => f.id === id);
}

export const cleanFolderName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 80) : "");
export const isFolderId = (v: unknown): v is string => typeof v === "string" && /^fld[0-9a-f]{12}$/.test(v);

export async function createFolder(name: string, campaignIds: string[] = []): Promise<Folder> {
  const now = new Date().toISOString();
  const folder: Folder = {
    id: `fld${randomBytes(6).toString("hex")}`,
    name,
    campaignIds: [...new Set(campaignIds)],
    createdAt: now,
    updatedAt: now,
  };
  await writeAll([...(await readAll()), folder]);
  return folder;
}

export async function updateFolder(
  id: string,
  patch: { name?: string; add?: string[]; remove?: string[] },
): Promise<Folder | undefined> {
  const all = await readAll();
  const folder = all.find((f) => f.id === id);
  if (!folder) return undefined;
  if (patch.name) folder.name = patch.name;
  const removing = new Set(patch.remove ?? []);
  // Newly added campaigns go to the top of the folder.
  const added = (patch.add ?? []).filter((c) => !folder.campaignIds.includes(c));
  folder.campaignIds = [...added, ...folder.campaignIds.filter((c) => !removing.has(c))];
  folder.updatedAt = new Date().toISOString();
  await writeAll(all);
  return folder;
}

export async function deleteFolder(id: string): Promise<boolean> {
  const all = await readAll();
  const rest = all.filter((f) => f.id !== id);
  if (rest.length === all.length) return false;
  await writeAll(rest);
  return true;
}

/** Takes a deleted campaign out of every folder it was in. */
export async function removeCampaignFromFolders(campaignId: string) {
  const all = await readAll();
  let changed = false;
  for (const f of all) {
    if (!f.campaignIds.includes(campaignId)) continue;
    f.campaignIds = f.campaignIds.filter((c) => c !== campaignId);
    f.updatedAt = new Date().toISOString();
    changed = true;
  }
  if (changed) await writeAll(all);
}
