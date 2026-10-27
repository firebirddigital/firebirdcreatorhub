// Analytics: campaign totals overall and by artist and partner. Partners come from the operations
// base's IP DB Roster and Partners tables, synced into this base as "Artists" and "Portfolio Companies".
// Server-side only.
import { listAll, type AirtableRecord } from "./airtable";
import { isSampleMode } from "./config";
import { engagementRate, getAllAssignments, getCampaigns, getCreators, getPosts, sumStats } from "./data";
import { expectedCpm } from "./format";
import { getRemovedPartners } from "./removed-partners";
import { ROSTER_SNAPSHOT_DATE, SNAPSHOT_ARTISTS, SNAPSHOT_COMPANIES } from "./roster-snapshot";
import type { Campaign, Stats } from "./types";

export const ARTISTS_TABLE = "Artists";
export const PORTFOLIO_TABLE = "Portfolio Companies";

import type { Period } from "./analytics-href";

export type { Period };

/** A campaign with its live post totals, approved spend and who it counts toward. */
export interface AnalyticsCampaign {
  id: string;
  name: string;
  /** The Artist field as written on the campaign. */
  artist: string;
  startDate?: string;
  status: Campaign["status"];
  /** Roster artists matched from the Artist field (empty when not found in IP DB Roster). */
  artists: string[];
  partners: string[];
  posts: number;
  stats: Stats;
  spend: number;
  costItems: { cost?: number; avgViews?: number }[];
}

export interface Totals {
  campaigns: number;
  posts: number;
  stats: Stats;
  engagementRate: number;
  spend: number;
  /** Spend ÷ views × 1,000, over campaigns with both spend and views. */
  currentCpm?: number;
  expected: { cpm?: number; counted: number; total: number };
}

export interface BreakdownRow extends Totals {
  name: string;
  portfolio?: boolean;
  types?: string[];
  rosterArtists?: number;
}

export interface Analytics {
  period: Period;
  artist?: string;
  partner?: string;
  options: { artists: string[]; partners: { name: string; portfolio: boolean }[] };
  totals: Totals;
  campaigns: AnalyticsCampaign[];
  byPartner: BreakdownRow[];
  byArtist: BreakdownRow[];
  /** Campaigns in view whose artist couldn't be matched to the roster, or has no partners. */
  unmatched: { id: string; name: string; artist: string; reason: string }[];
  /** Where artists and partners came from: the synced tables, or the built-in snapshot (with its date). */
  rosterSource: { kind: "airtable" | "snapshot" | "sample"; date?: string };
  /** Partners the team removed from Analytics; their campaigns don't count toward them. */
  removedPartners: string[];
}

// Synced values arrive as text, arrays of names or objects; flatten to names.
function names(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") return v.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(v)) return v.flatMap(names);
  if (typeof v === "object") return names((v as { name?: unknown }).name);
  return [];
}
const text = (v: unknown) => names(v)[0];

/** "Leon Bridges" and "leon-bridges!" match; used for artist names on campaigns vs the roster. */
export const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
/** "Artist A & Artist B", "A x B", "A feat. B" → each artist. */
const splitArtists = (s: string) =>
  s
    .split(/\s*(?:,|&|\+|\bx\b|\band\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);

async function readTable(table: string, missing: string[]): Promise<AirtableRecord[]> {
  try {
    return await listAll(table);
  } catch (e) {
    if (/NOT_FOUND|INVALID_PERMISSIONS|404|403/.test(String(e))) {
      missing.push(table);
      return [];
    }
    throw e;
  }
}

function inPeriod(c: { startDate?: string }, period: Period) {
  if (period === "all") return true;
  if (!c.startDate) return false;
  const start = new Date(`${c.startDate}T00:00:00Z`).getTime();
  const from = period === "year" ? Date.UTC(new Date().getUTCFullYear(), 0, 1) : Date.now() - 90 * 86_400_000;
  return start >= from;
}

/** Totals over a set of campaigns; each campaign counts once. */
export function totalsFor(campaigns: AnalyticsCampaign[]): Totals {
  const stats = sumStats(campaigns.map((c) => c.stats));
  const priced = campaigns.filter((c) => c.stats.views && c.spend);
  const pricedViews = priced.reduce((t, c) => t + c.stats.views, 0);
  return {
    campaigns: campaigns.length,
    posts: campaigns.reduce((t, c) => t + c.posts, 0),
    stats,
    engagementRate: engagementRate(stats),
    spend: campaigns.reduce((t, c) => t + c.spend, 0),
    currentCpm: pricedViews ? (priced.reduce((t, c) => t + c.spend, 0) / pricedViews) * 1000 : undefined,
    expected: expectedCpm(campaigns.flatMap((c) => c.costItems)),
  };
}

const byViews = (a: BreakdownRow, b: BreakdownRow) =>
  b.stats.views - a.stats.views || b.campaigns - a.campaigns || a.name.localeCompare(b.name);

export async function getAnalytics(
  filters: { period?: Period; artist?: string; partner?: string } = {},
): Promise<Analytics> {
  const period = filters.period ?? "all";
  const missingTables: string[] = [];
  const [liveArtists, liveCompanies, allCampaigns, posts, assignments, creators, removedPartners] = await Promise.all([
    isSampleMode() ? Promise.resolve(SAMPLE_ARTISTS) : readTable(ARTISTS_TABLE, missingTables),
    isSampleMode() ? Promise.resolve(SAMPLE_COMPANIES) : readTable(PORTFOLIO_TABLE, missingTables),
    getCampaigns(),
    getPosts(),
    getAllAssignments(),
    getCreators(),
    getRemovedPartners(),
  ]);
  const removedKeys = new Set(removedPartners.map(normalize));

  // Without both tables in this base, use the built-in snapshot of the roster.
  const useSnapshot = missingTables.length > 0;
  const artistRows = useSnapshot ? SNAPSHOT_ARTISTS.map(([Name, partners], i) => rec({ Name, "Partner(s)": partners }, i)) : liveArtists;
  const companyRows = useSnapshot
    ? SNAPSHOT_COMPANIES.map(([Name, types], i) => rec({ Name, "Organization Type": types }, i))
    : liveCompanies;
  const rosterSource: Analytics["rosterSource"] = isSampleMode()
    ? { kind: "sample" }
    : useSnapshot
      ? { kind: "snapshot", date: ROSTER_SNAPSHOT_DATE }
      : { kind: "airtable" };

  // Roster: artist → partners. An artist listed twice gets the partners from both rows.
  const rosterByKey = new Map<string, { name: string; partners: string[] }>();
  for (const r of artistRows) {
    const name = text(r.fields["Name"]);
    if (!name) continue;
    const key = normalize(name);
    const entry = rosterByKey.get(key) ?? { name, partners: [] };
    for (const p of names(r.fields["Partner(s)"])) {
      if (!removedKeys.has(normalize(p)) && !entry.partners.includes(p)) entry.partners.push(p);
    }
    rosterByKey.set(key, entry);
  }
  const roster = [...rosterByKey.values()];

  // Portfolio companies: rows with Firebird Ownership ticked or "True". If the column wasn't brought over
  // (the rows were filtered before import), every row counts. Airtable leaves empty and unticked fields out.
  const hasOwnership = companyRows.some((r) => "Firebird Ownership" in r.fields);
  const owned = (v: unknown) => v === true || /^(true|checked|yes)$/i.test(text(v) ?? "");
  const companies = new Map(
    companyRows
      .filter((r) => !hasOwnership || owned(r.fields["Firebird Ownership"]))
      .map((r) => ({ name: text(r.fields["Name"]) ?? "", types: names(r.fields["Organization Type"]) }))
      .filter((c) => c.name && !removedKeys.has(normalize(c.name)))
      .map((c) => [normalize(c.name), c]),
  );

  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const campaigns: AnalyticsCampaign[] = allCampaigns.map((campaign) => {
    const exact = rosterByKey.get(normalize(campaign.artist || ""));
    const matched = exact
      ? [exact]
      : splitArtists(campaign.artist || "")
          .map((n) => rosterByKey.get(normalize(n)))
          .filter((a): a is (typeof roster)[number] => Boolean(a));
    const live = posts.filter((p) => p.campaignId === campaign.id && p.status === "Live");
    const approved = assignments.filter((a) => a.campaignId === campaign.id && a.status === "Approved");
    return {
      id: campaign.id,
      name: campaign.name,
      artist: campaign.artist,
      startDate: campaign.startDate,
      status: campaign.status,
      artists: matched.map((a) => a.name),
      partners: [...new Set(matched.flatMap((a) => a.partners))],
      posts: live.length,
      stats: sumStats(live),
      spend: approved.reduce((t, a) => t + (a.fee ?? 0), 0),
      costItems: approved.map((a) => {
        const c = a.creatorId ? creatorById.get(a.creatorId) : undefined;
        return { cost: a.fee ?? c?.rate, avgViews: c?.avgViews };
      }),
    };
  });

  // Artist names for grouping: roster names when matched, otherwise what the campaign says.
  const artistNames = (c: AnalyticsCampaign) => (c.artists.length ? c.artists : c.artist ? [c.artist] : []);
  const partnerName = (n: string) => companies.get(normalize(n))?.name ?? n;

  const partnerOptions = new Map<string, string>();
  companies.forEach((c, k) => partnerOptions.set(k, c.name));
  campaigns.forEach((c) => c.partners.forEach((p) => partnerOptions.has(normalize(p)) || partnerOptions.set(normalize(p), p)));
  const artistOptions = new Map<string, string>();
  campaigns.forEach((c) => artistNames(c).forEach((a) => artistOptions.has(normalize(a)) || artistOptions.set(normalize(a), a)));
  const options = {
    artists: [...artistOptions.values()].sort((a, b) => a.localeCompare(b)),
    partners: [...partnerOptions]
      .map(([k, name]) => ({ name, portfolio: companies.has(k) }))
      .sort((a, b) => Number(b.portfolio) - Number(a.portfolio) || a.name.localeCompare(b.name)),
  };

  const artistKey = filters.artist ? normalize(filters.artist) : undefined;
  const partnerKey = filters.partner ? normalize(filters.partner) : undefined;
  const shown = campaigns
    .filter((c) => inPeriod(c, period))
    .filter((c) => !artistKey || artistNames(c).some((a) => normalize(a) === artistKey))
    .filter((c) => !partnerKey || c.partners.some((p) => normalize(p) === partnerKey))
    .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));

  // Partner breakdown: every portfolio company (even with no campaigns yet) plus any other partner in view.
  // A campaign counts toward every partner of its artist, so these rows can overlap.
  const partnerKeys = new Set(shown.flatMap((c) => c.partners.map(normalize)));
  if (!artistKey) companies.forEach((_, k) => partnerKeys.add(k));
  const byPartner: BreakdownRow[] = [...partnerKeys]
    .filter((k) => !partnerKey || k === partnerKey)
    .map((k) => ({
      name: partnerOptions.get(k) ?? k,
      portfolio: companies.has(k),
      types: companies.get(k)?.types ?? [],
      rosterArtists: roster.filter((a) => a.partners.some((p) => normalize(p) === k)).length,
      ...totalsFor(shown.filter((c) => c.partners.some((p) => normalize(p) === k))),
    }))
    .sort(byViews);

  // Artist breakdown: a campaign for "A & B" counts for both.
  const artistKeys = new Set(shown.flatMap((c) => artistNames(c).map(normalize)));
  const byArtist: BreakdownRow[] = [...artistKeys]
    .filter((k) => !artistKey || k === artistKey)
    .map((k) => ({
      name: artistOptions.get(k) ?? k,
      ...totalsFor(shown.filter((c) => artistNames(c).some((a) => normalize(a) === k))),
    }))
    .sort(byViews);

  const unmatched = shown
    .filter((c) => !c.partners.length)
    .map((c) => ({
      id: c.id,
      name: c.name,
      artist: c.artist,
      reason: c.artists.length ? "Artist has no partners listed" : "Artist not found in IP DB Roster",
    }));

  return {
    period,
    artist: artistKey ? (artistOptions.get(artistKey) ?? filters.artist) : undefined,
    partner: partnerKey ? partnerName(filters.partner!) : undefined,
    options,
    totals: totalsFor(shown),
    campaigns: shown,
    byPartner,
    byArtist,
    unmatched,
    rosterSource,
    removedPartners,
  };
}

// ---- Sample mode: fictional artists and partners matching the sample campaigns ----
const rec = (fields: Record<string, unknown>, i: number): AirtableRecord => ({ id: `recSample${i}`, createdTime: "", fields });
const SAMPLE_ARTISTS: AirtableRecord[] = [
  { Name: "The Copper Hours", "Partner(s)": ["Sample Light Management", "Sample Records"] },
  { Name: "Ivy Lane", "Partner(s)": ["Sample Light Management"] },
  { Name: "Northbound", "Partner(s)": ["Example Artists Group"] },
].map(rec);
const SAMPLE_COMPANIES: AirtableRecord[] = [
  { Name: "Sample Light Management", "Firebird Ownership": "True", "Organization Type": ["Management"], Status: "Active" },
  { Name: "Sample Records", "Firebird Ownership": "True", "Organization Type": ["Record Label"], Status: "Active" },
  { Name: "Example Artists Group", "Firebird Ownership": "True", "Organization Type": ["Management"], Status: "Active" },
  { Name: "Quiet Portfolio Co", "Firebird Ownership": "True", "Organization Type": ["Publisher"], Status: "Active" },
].map(rec);
