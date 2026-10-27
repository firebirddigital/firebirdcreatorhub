// Partner totals: which portfolio companies (and other partners) each campaign's artist belongs to,
// from the operations base's IP DB Roster and Partners tables synced into this base as "Artists" and
// "Portfolio Companies". Server-side only.
import { listAll, type AirtableRecord } from "./airtable";
import { isSampleMode } from "./config";
import { engagementRate, getAllAssignments, getCampaigns, getCreators, getPosts, sumStats } from "./data";
import { expectedCpm } from "./format";
import type { Campaign, Stats } from "./types";

export const ARTISTS_TABLE = "Artists";
export const PORTFOLIO_TABLE = "Portfolio Companies";

export type Period = "all" | "year" | "90d";

export interface PartnerCampaign {
  id: string;
  name: string;
  artist: string;
  startDate?: string;
  status: Campaign["status"];
  posts: number;
  views: number;
  spend: number;
}

export interface PartnerStats {
  name: string;
  portfolio: boolean;
  types: string[];
  active: boolean;
  /** Artists on this partner's roster (from IP DB Roster). */
  rosterArtists: string[];
  /** Of those, artists with a campaign in the period. */
  campaignArtists: string[];
  campaigns: PartnerCampaign[];
  totals: Stats & { posts: number };
  engagementRate: number;
  spend: number;
  currentCpm?: number;
  expected: { cpm?: number; counted: number; total: number };
}

export interface PartnerReport {
  partners: PartnerStats[];
  /** Campaigns in the period whose artist couldn't be matched to the roster, or has no partners. */
  unmatched: { id: string; name: string; artist: string; reason: string }[];
  missingTables: string[];
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

export const partnerSlug = (name: string) => encodeURIComponent(normalize(name) || name);

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

function inPeriod(c: Campaign, period: Period) {
  if (period === "all") return true;
  if (!c.startDate) return false;
  const start = new Date(`${c.startDate}T00:00:00Z`).getTime();
  const from = period === "year" ? Date.UTC(new Date().getUTCFullYear(), 0, 1) : Date.now() - 90 * 86_400_000;
  return start >= from;
}

export async function getPartnerReport(period: Period = "all"): Promise<PartnerReport> {
  const missingTables: string[] = [];
  const [artistRows, companyRows, campaigns, posts, assignments, creators] = await Promise.all([
    isSampleMode() ? Promise.resolve(SAMPLE_ARTISTS) : readTable(ARTISTS_TABLE, missingTables),
    isSampleMode() ? Promise.resolve(SAMPLE_COMPANIES) : readTable(PORTFOLIO_TABLE, missingTables),
    getCampaigns(),
    getPosts(),
    getAllAssignments(),
    getCreators(),
  ]);

  // Roster: artist → partners
  const artists = artistRows
    .map((r) => ({ name: text(r.fields["Name"]) ?? "", partners: names(r.fields["Partner(s)"]) }))
    .filter((a) => a.name);
  const artistByKey = new Map(artists.map((a) => [normalize(a.name), a]));

  // Portfolio companies (Firebird Ownership = True when the field is synced; otherwise every row counts)
  const companies = new Map(
    companyRows
      .map((r) => ({
        name: text(r.fields["Name"]) ?? "",
        ownership: text(r.fields["Firebird Ownership"]),
        types: names(r.fields["Organization Type"]),
        status: text(r.fields["Status"]),
      }))
      .filter((c) => c.name && c.ownership !== "False")
      .map((c) => [normalize(c.name), c]),
  );

  const creatorById = new Map(creators.map((c) => [c.id, c]));
  const stats = new Map<string, PartnerStats>();
  const ensure = (name: string) => {
    const key = normalize(name);
    let s = stats.get(key);
    if (!s) {
      const co = companies.get(key);
      s = {
        name: co?.name ?? name,
        portfolio: Boolean(co),
        types: co?.types ?? [],
        active: co ? co.status !== "Inactive" : true,
        rosterArtists: [],
        campaignArtists: [],
        campaigns: [],
        totals: { views: 0, likes: 0, comments: 0, shares: 0, posts: 0 },
        engagementRate: 0,
        spend: 0,
        expected: { counted: 0, total: 0 },
      };
      stats.set(key, s);
    }
    return s;
  };
  // Every portfolio company appears, even with no campaigns yet; roster artists listed under each partner.
  companies.forEach((c) => ensure(c.name));
  artists.forEach((a) => a.partners.forEach((p) => ensure(p).rosterArtists.push(a.name)));

  const unmatched: PartnerReport["unmatched"] = [];
  const costItems = new Map<string, { cost?: number; avgViews?: number }[]>();

  for (const campaign of campaigns.filter((c) => inPeriod(c, period))) {
    const matched = splitArtists(campaign.artist || "").map((n) => artistByKey.get(normalize(n))).filter(Boolean);
    const exact = artistByKey.get(normalize(campaign.artist || ""));
    const campaignArtists = exact ? [exact] : (matched as typeof artists);
    if (!campaignArtists.length) {
      unmatched.push({ id: campaign.id, name: campaign.name, artist: campaign.artist, reason: "Artist not found in IP DB Roster" });
      continue;
    }
    const partnerNames = [...new Set(campaignArtists.flatMap((a) => a.partners))];
    if (!partnerNames.length) {
      unmatched.push({ id: campaign.id, name: campaign.name, artist: campaign.artist, reason: "Artist has no partners listed" });
      continue;
    }

    const cp = posts.filter((p) => p.campaignId === campaign.id && p.status === "Live");
    const t = sumStats(cp);
    const approved = assignments.filter((a) => a.campaignId === campaign.id && a.status === "Approved");
    const spend = approved.reduce((sum, a) => sum + (a.fee ?? 0), 0);
    const items = approved.map((a) => {
      const c = a.creatorId ? creatorById.get(a.creatorId) : undefined;
      return { cost: a.fee ?? c?.rate, avgViews: c?.avgViews };
    });

    for (const pn of partnerNames) {
      const s = ensure(pn);
      s.campaigns.push({
        id: campaign.id,
        name: campaign.name,
        artist: campaign.artist,
        startDate: campaign.startDate,
        status: campaign.status,
        posts: cp.length,
        views: t.views,
        spend,
      });
      s.totals = { ...sumStats([s.totals, t]), posts: s.totals.posts + cp.length };
      s.spend += spend;
      for (const a of campaignArtists) if (a.partners.includes(pn) && !s.campaignArtists.includes(a.name)) s.campaignArtists.push(a.name);
      costItems.set(normalize(pn), [...(costItems.get(normalize(pn)) ?? []), ...items]);
    }
  }

  const partners = [...stats.values()].map((s) => {
    const spendWithViews = s.campaigns.filter((c) => c.views && c.spend);
    const views = spendWithViews.reduce((t, c) => t + c.views, 0);
    return {
      ...s,
      rosterArtists: [...new Set(s.rosterArtists)].sort(),
      campaigns: s.campaigns.sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")),
      engagementRate: engagementRate(s.totals),
      currentCpm: views ? (spendWithViews.reduce((t, c) => t + c.spend, 0) / views) * 1000 : undefined,
      expected: expectedCpm(costItems.get(normalize(s.name)) ?? []),
    };
  });
  partners.sort((a, b) => b.totals.views - a.totals.views || Number(b.portfolio) - Number(a.portfolio) || a.name.localeCompare(b.name));
  return { partners, unmatched, missingTables };
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
