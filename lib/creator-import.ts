// Bulk creator import from a CSV. Server-side only.
import { createRecords, updateRecords } from "./airtable";
import { CREATOR_FIELDS as CRF, TABLES } from "./config";
import type { RawCreatorRow } from "./csv-import";
import { getCreators } from "./data";
import { profileFromUrl } from "./social";
import type { Creator, Platform } from "./types";

export type ImportAction = "create" | "update" | "unchanged" | "duplicate" | "skip";

export interface ImportRowResult {
  row: number; // 1-based, matching the spreadsheet row under the header
  action: ImportAction;
  name?: string;
  /** For update/unchanged/duplicate: who it matched. For update: what gets filled in. */
  detail?: string;
  warnings: string[];
}

interface Clean {
  name?: string;
  instagram?: string;
  tiktok?: string;
  email?: string;
  tags: string[];
  location?: string;
  rate?: number;
  notes?: string;
  instagramFollowers?: number;
  tiktokFollowers?: number;
}

const HANDLE = /^[\w.]{1,30}$/;

/** A handle from "@name", "name" or a profile link. Links to the other platform are returned as such. */
function handleFrom(value: string, platform: Platform): { platform: Platform; handle: string } | undefined {
  const v = value.trim();
  if (/^https?:|^www\.|\/|\.com\b/i.test(v)) return profileFromUrl(v);
  const h = v.replace(/^@/, "").trim().toLowerCase();
  return HANDLE.test(h) ? { platform, handle: h } : undefined;
}

const number = (v?: string) => {
  if (!v) return undefined;
  const m = v.replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]) * (m[2]?.toLowerCase() === "k" ? 1_000 : m[2]?.toLowerCase() === "m" ? 1_000_000 : 1);
  return n > 0 ? Math.round(n) : undefined;
};

function clean(raw: RawCreatorRow): { c: Clean; warnings: string[] } {
  const warnings: string[] = [];
  const c: Clean = { tags: [...new Set((raw.tags ?? []).map((t) => t.replace(/,/g, "").slice(0, 50)).filter(Boolean))].slice(0, 30) };

  const handles: { platform: Platform; handle: string }[] = [];
  for (const [value, platform] of [
    [raw.instagram, "instagram"],
    [raw.tiktok, "tiktok"],
  ] as [string | undefined, Platform][]) {
    if (!value) continue;
    const h = handleFrom(value, platform);
    if (h) handles.push(h);
    else warnings.push(`Couldn't read the ${platform === "tiktok" ? "TikTok" : "Instagram"} handle “${value.slice(0, 60)}”.`);
  }
  for (const link of raw.links ?? []) {
    const h = profileFromUrl(link);
    if (h) handles.push(h);
    else if (/^@?[\w.]+$/.test(link)) warnings.push(`“${link.slice(0, 60)}” could be Instagram or TikTok. Put it in a TikTok or Instagram column.`);
    else warnings.push(`Skipped the link “${link.slice(0, 60)}” (only TikTok and Instagram profile links are read).`);
  }
  for (const h of handles) {
    if (h.platform === "instagram") c.instagram ??= h.handle;
    else c.tiktok ??= h.handle;
  }

  c.name = raw.name?.trim().slice(0, 100) || c.tiktok || c.instagram;
  if (raw.email) {
    const e = raw.email.trim().slice(0, 200);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) c.email = e;
    else warnings.push(`Skipped the email “${e.slice(0, 60)}” (doesn't look like an email).`);
  }
  c.location = raw.location?.trim().slice(0, 100) || undefined;
  c.notes = raw.notes?.trim().slice(0, 2000) || undefined;
  if (raw.rate) {
    c.rate = number(raw.rate);
    if (!c.rate) warnings.push(`Skipped the rate “${raw.rate.slice(0, 30)}” (not a number).`);
  }
  c.instagramFollowers = number(raw.instagramFollowers);
  c.tiktokFollowers = number(raw.tiktokFollowers);
  return { c, warnings };
}

/** Fields to write for a new creator. */
function createFields(c: Clean): Record<string, unknown> {
  return {
    [CRF.name]: c.name,
    ...(c.instagram ? { [CRF.instagram]: c.instagram } : {}),
    ...(c.tiktok ? { [CRF.tiktok]: c.tiktok } : {}),
    ...(c.email ? { [CRF.email]: c.email } : {}),
    ...(c.tags.length ? { [CRF.tags]: c.tags } : {}),
    ...(c.location ? { [CRF.location]: c.location } : {}),
    ...(c.rate ? { [CRF.rate]: c.rate } : {}),
    ...(c.instagramFollowers && c.instagram ? { [CRF.instagramFollowers]: c.instagramFollowers } : {}),
    ...(c.tiktokFollowers && c.tiktok ? { [CRF.tiktokFollowers]: c.tiktokFollowers } : {}),
    [CRF.notes]: c.notes ?? "Imported from a CSV.",
  };
}

/** For an existing creator: new tags plus anything they're missing. Never overwrites what's there. */
function fillFields(existing: Creator, c: Clean): { fields: Record<string, unknown>; filled: string[] } {
  const fields: Record<string, unknown> = {};
  const filled: string[] = [];
  const newTags = c.tags.filter((t) => !existing.tags.includes(t));
  if (newTags.length) {
    fields[CRF.tags] = [...existing.tags, ...newTags];
    filled.push(`tags ${newTags.join(", ")}`);
  }
  const fill = (has: unknown, field: string, value: unknown, label: string) => {
    if (!has && value) {
      fields[field] = value;
      filled.push(label);
    }
  };
  fill(existing.instagram, CRF.instagram, c.instagram, "Instagram");
  fill(existing.tiktok, CRF.tiktok, c.tiktok, "TikTok");
  fill(existing.email, CRF.email, c.email, "email");
  fill(existing.location, CRF.location, c.location, "location");
  fill(existing.rate, CRF.rate, c.rate, "rate");
  fill(existing.instagramFollowers, CRF.instagramFollowers, (existing.instagram || c.instagram) && c.instagramFollowers, "Instagram followers");
  fill(existing.tiktokFollowers, CRF.tiktokFollowers, (existing.tiktok || c.tiktok) && c.tiktokFollowers, "TikTok followers");
  return { fields, filled };
}

/**
 * Matches each row to an existing creator (by Instagram or TikTok handle, or exact name when a row
 * has no handles) or to an earlier row in the same file, then creates and updates in bulk.
 * With dryRun, nothing is written: the results are the preview.
 */
export async function importCreators(
  rows: RawCreatorRow[],
  opts: { dryRun: boolean; firstRow?: number },
): Promise<{ results: ImportRowResult[]; counts: Record<ImportAction, number> }> {
  const roster = await getCreators({ fresh: true });
  const byIg = new Map<string, Creator>();
  const byTt = new Map<string, Creator>();
  const byName = new Map<string, Creator>();
  for (const cr of roster) {
    if (cr.instagram) byIg.set(cr.instagram.toLowerCase(), cr);
    if (cr.tiktok) byTt.set(cr.tiktok.toLowerCase(), cr);
    byName.set(cr.name.toLowerCase(), cr);
  }

  const pendingCreates: { clean: Clean; row: number }[] = [];
  const createdByKey = new Map<string, number>(); // "ig:x" / "tt:x" / "name:x" → index in pendingCreates
  const updates = new Map<string, { existing: Creator; fields: Record<string, unknown> }>();
  const results: ImportRowResult[] = [];

  rows.forEach((raw, i) => {
    const row = (opts.firstRow ?? 1) + i;
    const { c, warnings } = clean(raw);
    if (!c.name) {
      results.push({ row, action: "skip", detail: "No name and no TikTok or Instagram handle.", warnings });
      return;
    }
    const keys = [
      c.instagram && `ig:${c.instagram}`,
      c.tiktok && `tt:${c.tiktok}`,
      !c.instagram && !c.tiktok && `name:${c.name.toLowerCase()}`,
    ].filter((k): k is string => Boolean(k));

    // Already in the database?
    const existing =
      (c.instagram && byIg.get(c.instagram)) ||
      (c.tiktok && byTt.get(c.tiktok)) ||
      (!c.instagram && !c.tiktok ? byName.get(c.name.toLowerCase()) : undefined);
    if (existing) {
      // Combine with earlier rows for the same creator, using what those rows will already set.
      const pending = updates.get(existing.id);
      const base: Creator = pending ? { ...existing, ...creatorFromFields(existing, pending.fields) } : existing;
      const { fields, filled } = fillFields(base, c);
      if (Object.keys(fields).length) {
        updates.set(existing.id, { existing, fields: { ...(pending?.fields ?? {}), ...fields } });
        results.push({ row, action: "update", name: existing.name, detail: `Already in the database. Adds ${filled.join(", ")}.`, warnings });
      } else {
        results.push({ row, action: "unchanged", name: existing.name, detail: "Already in the database with these details.", warnings });
      }
      return;
    }

    // Same creator earlier in this file?
    const earlier = keys.map((k) => createdByKey.get(k)).find((x) => x !== undefined);
    if (earlier !== undefined) {
      const first = pendingCreates[earlier];
      first.clean = mergeClean(first.clean, c);
      keys.forEach((k) => createdByKey.set(k, earlier));
      results.push({ row, action: "duplicate", name: first.clean.name, detail: `Same creator as row ${first.row}; combined into one.`, warnings });
      return;
    }

    pendingCreates.push({ clean: c, row });
    keys.forEach((k) => createdByKey.set(k, pendingCreates.length - 1));
    results.push({ row, action: "create", name: c.name, warnings });
  });

  if (!opts.dryRun) {
    if (pendingCreates.length) await createRecords(TABLES.creators, pendingCreates.map((p) => ({ fields: createFields(p.clean) })));
    if (updates.size) await updateRecords(TABLES.creators, [...updates.entries()].map(([id, u]) => ({ id, fields: u.fields })));
  }

  const counts = { create: 0, update: 0, unchanged: 0, duplicate: 0, skip: 0 } as Record<ImportAction, number>;
  results.forEach((r) => counts[r.action]++);
  return { results, counts };
}

/** Earlier row's details win; the later row fills gaps and adds tags. */
function mergeClean(a: Clean, b: Clean): Clean {
  return {
    name: a.name,
    instagram: a.instagram ?? b.instagram,
    tiktok: a.tiktok ?? b.tiktok,
    email: a.email ?? b.email,
    tags: [...new Set([...a.tags, ...b.tags])].slice(0, 30),
    location: a.location ?? b.location,
    rate: a.rate ?? b.rate,
    notes: a.notes ?? b.notes,
    instagramFollowers: a.instagramFollowers ?? b.instagramFollowers,
    tiktokFollowers: a.tiktokFollowers ?? b.tiktokFollowers,
  };
}

/** Reads pending update fields back as Creator values, so several rows for one creator combine correctly. */
function creatorFromFields(existing: Creator, f: Record<string, unknown>): Partial<Creator> {
  return {
    ...(f[CRF.tags] ? { tags: f[CRF.tags] as string[] } : {}),
    ...(f[CRF.instagram] ? { instagram: f[CRF.instagram] as string } : {}),
    ...(f[CRF.tiktok] ? { tiktok: f[CRF.tiktok] as string } : {}),
    ...(f[CRF.email] ? { email: f[CRF.email] as string } : {}),
    ...(f[CRF.location] ? { location: f[CRF.location] as string } : {}),
    ...(f[CRF.rate] ? { rate: f[CRF.rate] as number } : {}),
    ...(f[CRF.instagramFollowers] ? { instagramFollowers: f[CRF.instagramFollowers] as number } : {}),
    ...(f[CRF.tiktokFollowers] ? { tiktokFollowers: f[CRF.tiktokFollowers] as number } : {}),
  };
}
