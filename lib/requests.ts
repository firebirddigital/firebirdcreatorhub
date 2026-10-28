// Campaign requests from the operations base's two Airtable forms. Two ways in:
//   - Direct (REQUESTS_AIRTABLE_TOKEN set): read straight from the operations base with a read-only key.
//     The hub keeps each request's status in its own ledger (request-ledger.ts), and new requests are
//     turned into Planning campaigns automatically (importNewRequests).
//   - Synced: Airtable Sync copies the tables into the Creator Hub base, and the hub writes its two
//     fields (Hub Status, Hub Campaign) on the copies.
//   REQUESTS_AIRTABLE_TOKEN     read-only key, operations base only
//   REQUESTS_BASE_ID            operations base (default: Firebird Digital)
//   REQUESTS_TABLE_INFLUENCER   its influencer form table (default "CREATOR CAMPAIGN REQUEST FORM")
//   REQUESTS_TABLE_SEEDING      its seeding form table (default "Content Seeding Requests")
// Server-side only.
import { createRecords, listAll, num, updateRecords, type AirtableRecord, type OtherBase } from "./airtable";
import { CAMPAIGN_FIELDS as CF, isSampleMode, TABLES } from "./config";
import { getCampaign, getCampaigns } from "./data";
import { privateBlobToken } from "./blob";
import { readLedger, updateLedger, type RequestLedger } from "./request-ledger";
import type { CampaignType } from "./types";

export type RequestSource = "influencer" | "seeding";
export type HubStatus = "New" | "Accepted" | "Dismissed";

export interface CampaignRequest {
  id: string; // record ID of the synced copy in the Creator Hub base
  source: RequestSource;
  /** Record ID in the operations base (its "Record ID" formula), for status write-back. */
  sourceRecordId?: string;
  name: string;
  artist: string;
  partners: string[];
  submitterEmail?: string;
  billingName?: string;
  billingEmail?: string;
  /** Their own status in the operations base (Todo / In progress / Done, or Requested / Live / Wrapped). */
  status?: string;
  strategy: string[];
  platforms: string[];
  budget?: number;
  launchDate?: string;
  endDate?: string;
  keyDate?: string;
  /** Long answers, in form order, for the campaign brief. */
  sections: { label: string; text: string }[];
  hubStatus: HubStatus;
  hubCampaignIds: string[];
  createdTime: string;
}

/** Synced table names in the Creator Hub base, and how each form's fields map. Rename here if you rename in Airtable. */
export const REQUEST_SOURCES: Record<
  RequestSource,
  {
    table: string;
    type: CampaignType;
    fields: {
      name: string;
      artist: string;
      partners: string;
      roster: string;
      submitter: string;
      status: string;
      strategy: string;
      platforms: string;
      budget: string;
      launch: string;
      end?: string;
      key?: string;
      billingName: string;
      billingEmail: string;
      sections: [string, string][]; // [field, label]
    };
  }
> = {
  influencer: {
    table: "Influencer Requests",
    type: "Influencer",
    fields: {
      name: "Project Name",
      artist: "Artist Name",
      partners: "Partner(s) (from IP DB Roster)",
      roster: "IP DB Roster",
      submitter: "Submitter Email",
      status: "Status",
      strategy: "Strategy Type",
      platforms: "Platforms",
      budget: "Budget",
      launch: "Launch Date",
      key: "Key Date",
      billingName: "Billing Contact - Name",
      billingEmail: "Billing Contact - Email",
      sections: [
        ["Talking Points / Vision", "Talking points and vision"],
        ["Types of Creators / Creator Examples", "Creators we're looking for"],
        ["Number of Posts Requested", "Posts requested"],
        ["Song Link", "Song"],
        ["Video/Image Assets", "Assets"],
      ],
    },
  },
  seeding: {
    table: "Content Seeding Requests",
    type: "Content Seeding",
    fields: {
      name: "Content Seeding Request",
      artist: "Artist Name (From Form)",
      partners: "Partner(s) (from IP DB Roster)",
      roster: "IP DB Roster",
      submitter: "Submitter Email Address",
      status: "Status",
      strategy: "Content Seeding Strategy",
      platforms: "Platforms",
      budget: "Budget",
      launch: "Launch Date",
      end: "End Date",
      billingName: "Billing Contact - Name",
      billingEmail: "Billing Contact - Email",
      sections: [
        ["Campaign Vision", "Campaign vision"],
        ["Audience Tiers", "Audience tiers"],
        ["TikTok Audio Link", "TikTok sound"],
        ["Instagram Audio Link", "Instagram audio"],
        ["YouTube Audio Link", "YouTube audio"],
        ["Assets", "Assets"],
      ],
    },
  },
};

export const HUB_FIELDS = { status: "Hub Status", campaign: "Hub Campaign", recordId: "Record ID" } as const;

/** The operations base, when the hub reads it directly with its read-only key. */
const directBase = (): OtherBase | undefined =>
  // Needs private storage too, for the hub's record of what it has done with each request.
  process.env.REQUESTS_AIRTABLE_TOKEN && privateBlobToken()
    ? { id: process.env.REQUESTS_BASE_ID || "applP9sX2S8LkcG8O", token: process.env.REQUESTS_AIRTABLE_TOKEN }
    : undefined;
export const requestsDirect = () => Boolean(directBase());

const tableFor = (source: RequestSource) =>
  !directBase()
    ? REQUEST_SOURCES[source].table
    : source === "influencer"
      ? process.env.REQUESTS_TABLE_INFLUENCER || "CREATOR CAMPAIGN REQUEST FORM"
      : process.env.REQUESTS_TABLE_SEEDING || "Content Seeding Requests";

// Synced values arrive in several shapes: plain text, rich text (markdown), arrays of names, or
// objects with a name. Flatten them all to text.
function texts(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === "string") return v.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "number") return [String(v)];
  if (Array.isArray(v)) return v.flatMap(texts);
  if (typeof v === "object") {
    const o = v as { name?: unknown; value?: unknown };
    return texts(o.name ?? o.value);
  }
  return [];
}
const text = (v: unknown) => {
  if (typeof v === "string") return v.trim() || undefined;
  const t = texts(v);
  return t.length ? t.join(", ") : undefined;
};
const longText = (v: unknown) => (typeof v === "string" ? v.replace(/\n{3,}/g, "\n\n").trim() || undefined : text(v));
const date = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);
const email = (v: unknown) => text(v)?.match(/[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+/)?.[0];

function mapRequest(source: RequestSource, r: AirtableRecord, ledger?: RequestLedger): CampaignRequest {
  const f = REQUEST_SOURCES[source].fields;
  const v = r.fields;
  let hub = text(v[HUB_FIELDS.status]);
  let hubCampaignIds = Array.isArray(v[HUB_FIELDS.campaign]) ? (v[HUB_FIELDS.campaign] as string[]) : [];
  if (ledger) {
    // Direct: status comes from the hub's ledger. Requests from before auto-import started count as
    // handled, so the backlog doesn't flood the inbox; any of them can be reopened.
    const entry = ledger.entries[r.id];
    hub = entry?.status ?? (r.createdTime < ledger.startedAt ? "Dismissed" : "New");
    hubCampaignIds = entry?.campaignIds ?? [];
  }
  return {
    id: r.id,
    source,
    sourceRecordId: ledger ? r.id : text(v[HUB_FIELDS.recordId]),
    name: text(v[f.name]) ?? "Untitled request",
    artist: text(v[f.artist]) ?? text(v[f.roster]) ?? "",
    partners: [...new Set(texts(v[f.partners]))],
    submitterEmail: email(v[f.submitter]),
    billingName: text(v[f.billingName]),
    billingEmail: email(v[f.billingEmail]),
    status: text(v[f.status]),
    strategy: texts(v[f.strategy]),
    platforms: texts(v[f.platforms]),
    budget: num(v[f.budget]) || undefined,
    launchDate: date(v[f.launch]),
    endDate: f.end ? date(v[f.end]) : undefined,
    keyDate: f.key ? date(v[f.key]) : undefined,
    sections: f.sections
      .map(([field, label]) => ({ label, text: longText(v[field]) ?? "" }))
      .filter((s) => s.text),
    hubStatus: hub === "Accepted" || hub === "Dismissed" ? hub : "New",
    hubCampaignIds,
    createdTime: r.createdTime,
  };
}

/** Requests from both synced tables, newest first. A table that isn't synced yet is skipped. */
export async function getRequests(opts: { fresh?: boolean } = {}): Promise<{ requests: CampaignRequest[]; missingTables: string[] }> {
  if (isSampleMode()) return { requests: SAMPLE_REQUESTS, missingTables: [] };
  const missingTables: string[] = [];
  const base = directBase();
  const ledger = base ? await readLedger() : undefined;
  const lists = await Promise.all(
    (Object.keys(REQUEST_SOURCES) as RequestSource[]).map(async (source) => {
      try {
        return (await listAll(tableFor(source), {}, { ...opts, base })).map((r) => mapRequest(source, r, ledger));
      } catch (e) {
        if (/NOT_FOUND|INVALID_PERMISSIONS|404|403/.test(String(e))) {
          missingTables.push(tableFor(source));
          return [];
        }
        throw e;
      }
    }),
  );
  const requests = lists.flat().sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  return { requests, missingTables };
}

export async function getRequest(id: string): Promise<CampaignRequest | undefined> {
  return (await getRequests({ fresh: true })).requests.find((r) => r.id === id);
}

/** The partner contacts block saved on the campaign (team only; stripped from partner pages). */
export function contactsText(r: CampaignRequest): string {
  return [
    r.partners.length ? `Partners: ${r.partners.join(", ")}` : "",
    r.submitterEmail ? `Submitted by: ${r.submitterEmail}` : "",
    r.billingName || r.billingEmail ? `Billing: ${[r.billingName, r.billingEmail].filter(Boolean).join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** The campaign brief, built from the form's long answers. Creators see this on their upload page. */
export function briefText(r: CampaignRequest): string {
  const facts = [
    r.strategy.length ? `Strategy: ${r.strategy.join(", ")}` : "",
    r.platforms.length ? `Platforms: ${r.platforms.join(", ")}` : "",
    r.keyDate ? `Key date: ${r.keyDate}` : "",
  ].filter(Boolean);
  return [facts.join("\n"), ...r.sections.map((s) => `${s.label.toUpperCase()}\n${s.text}`)].filter(Boolean).join("\n\n");
}

/** Song name from a project name like "'Fly Baby' Fashion Edit" → Fly Baby. */
export const songFromName = (name: string) => name.match(/["'“‘]([^"'”’]{2,60})["'”’]/)?.[1]?.trim();

async function writeHub(request: CampaignRequest, fields: Record<string, unknown>, auto = false) {
  if (directBase()) {
    const status = fields[HUB_FIELDS.status] as "Accepted" | "Dismissed" | "New";
    const campaignIds = (fields[HUB_FIELDS.campaign] as string[] | undefined) ?? request.hubCampaignIds;
    await updateLedger((l) => {
      l.entries[request.id] = { status, campaignIds, ...(auto ? { auto: true } : {}) };
    });
    return;
  }
  try {
    await updateRecords(REQUEST_SOURCES[request.source].table, [{ id: request.id, fields }]);
  } catch (e) {
    if (String(e).includes("UNKNOWN_FIELD_NAME")) {
      throw new RequestSetupError(
        `Add the “${HUB_FIELDS.status}” (single select: New, Accepted, Dismissed) and “${HUB_FIELDS.campaign}” (link to Campaigns) fields to the ${REQUEST_SOURCES[request.source].table} table in Airtable.`,
      );
    }
    throw e;
  }
}

/** Something the team needs to set up in Airtable; safe to show them. */
export class RequestSetupError extends Error {}

/** Merges new contact lines into what's already on a campaign, without repeating lines. */
function mergeContacts(existing: string | undefined, add: string) {
  const lines = [...(existing ?? "").split("\n"), ...add.split("\n")].map((l) => l.trim()).filter(Boolean);
  return [...new Set(lines)].join("\n");
}

async function saveContacts(campaignId: string, contacts: string): Promise<boolean> {
  if (!contacts) return true;
  const campaign = await getCampaign(campaignId);
  try {
    await updateRecords(TABLES.campaigns, [
      { id: campaignId, fields: { [CF.partnerContacts]: mergeContacts(campaign?.partnerContacts, contacts) } },
    ]);
    return true;
  } catch (e) {
    if (String(e).includes("UNKNOWN_FIELD_NAME")) return false;
    throw e;
  }
}

/** Creates a campaign from a request (as Planning, sharing off), then marks the request Accepted. */
export async function acceptAsNewCampaign(
  request: CampaignRequest,
  opts: { auto?: boolean } = {},
): Promise<{ campaignId: string; contactsSaved: boolean }> {
  const fields: Record<string, unknown> = {
    [CF.name]: request.name.slice(0, 120),
    [CF.artist]: request.artist.slice(0, 120),
    [CF.status]: "Planning",
    [CF.stage]: "Creators",
    [CF.brief]: briefText(request).slice(0, 10_000),
    ...(songFromName(request.name) ? { [CF.song]: songFromName(request.name) } : {}),
    ...(request.launchDate ? { [CF.startDate]: request.launchDate } : {}),
    ...(request.endDate ? { [CF.endDate]: request.endDate } : {}),
    ...(request.budget ? { [CF.budget]: request.budget } : {}),
    [CF.type]: REQUEST_SOURCES[request.source].type,
  };
  // Type and Partner Contacts are optional fields; save without them if the base doesn't have them yet.
  let rec: AirtableRecord;
  try {
    [rec] = await createRecords(TABLES.campaigns, [{ fields }]);
  } catch (e) {
    if (!String(e).includes("UNKNOWN_FIELD_NAME")) throw e;
    const { [CF.type]: _t, ...rest } = fields;
    [rec] = await createRecords(TABLES.campaigns, [{ fields: rest }]);
  }
  const contactsSaved = await saveContacts(rec.id, contactsText(request));
  await writeHub(request, { [HUB_FIELDS.status]: "Accepted", [HUB_FIELDS.campaign]: [rec.id] }, opts.auto);
  return { campaignId: rec.id, contactsSaved };
}

/**
 * Turns new form submissions into Planning campaigns (sharing off), when reading the operations base
 * directly. Runs when the team opens Campaigns (at most every 2 minutes) and with the daily refresh.
 * Only requests submitted after auto-import started; never the same request twice.
 */
export async function importNewRequests(opts: { force?: boolean } = {}): Promise<{ created: { requestId: string; campaignId: string; name: string }[] }> {
  if (isSampleMode() || !directBase()) return { created: [] };
  const ledger = await readLedger();
  if (!opts.force && ledger.lastImportAt && Date.now() - new Date(ledger.lastImportAt).getTime() < 120_000) return { created: [] };
  await updateLedger((l) => {
    l.lastImportAt = new Date().toISOString();
  });

  const [{ requests }, campaigns] = await Promise.all([getRequests({ fresh: true }), getCampaigns({ fresh: true })]);
  const existing = new Set(campaigns.map((c) => `${c.name.trim().toLowerCase()}|${c.artist.trim().toLowerCase()}`));
  const created: { requestId: string; campaignId: string; name: string }[] = [];
  for (const r of requests.filter((x) => x.hubStatus === "New" && x.createdTime >= ledger.startedAt)) {
    // Re-check just before creating, in case another visit got here first.
    if ((await readLedger()).entries[r.id]) continue;
    const key = `${r.name.slice(0, 120).trim().toLowerCase()}|${r.artist.slice(0, 120).trim().toLowerCase()}`;
    if (existing.has(key)) continue;
    const { campaignId } = await acceptAsNewCampaign(r, { auto: true });
    existing.add(key);
    created.push({ requestId: r.id, campaignId, name: r.name });
  }
  return { created };
}

/**
 * Attaches a request to a campaign that already exists: adds its partner contacts, fills in any campaign
 * details still blank (brief, dates, budget, song, type) and marks it Accepted. Never overwrites what's there.
 */
export async function acceptIntoCampaign(
  request: CampaignRequest,
  campaignId: string,
): Promise<{ contactsSaved: boolean; filled: string[] }> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new RequestSetupError("That campaign doesn't exist any more.");
  const brief = briefText(request).slice(0, 10_000);
  const song = songFromName(request.name);
  const blanks: [string, string, unknown][] = [
    ["brief", CF.brief, !campaign.brief && brief ? brief : undefined],
    ["start date", CF.startDate, !campaign.startDate ? request.launchDate : undefined],
    ["end date", CF.endDate, !campaign.endDate ? request.endDate : undefined],
    ["budget", CF.budget, !campaign.budget ? request.budget : undefined],
    ["song", CF.song, !campaign.song ? song : undefined],
    ["type", CF.type, !campaign.type ? REQUEST_SOURCES[request.source].type : undefined],
  ];
  const fill = blanks.filter(([, , v]) => v !== undefined && v !== "");
  if (fill.length) {
    const fields = Object.fromEntries(fill.map(([, f, v]) => [f, v]));
    try {
      await updateRecords(TABLES.campaigns, [{ id: campaignId, fields }]);
    } catch (e) {
      // Type is an optional field; fill the rest without it.
      if (!String(e).includes("UNKNOWN_FIELD_NAME")) throw e;
      const { [CF.type]: _t, ...rest } = fields;
      if (Object.keys(rest).length) await updateRecords(TABLES.campaigns, [{ id: campaignId, fields: rest }]);
      const t = fill.findIndex(([, f]) => f === CF.type);
      if (t >= 0) fill.splice(t, 1);
    }
  }
  const contactsSaved = await saveContacts(campaignId, contactsText(request));
  await writeHub(request, {
    [HUB_FIELDS.status]: "Accepted",
    [HUB_FIELDS.campaign]: [...new Set([...request.hubCampaignIds, campaignId])],
  });
  return { contactsSaved, filled: fill.map(([label]) => label) };
}

export async function dismissRequest(request: CampaignRequest) {
  await writeHub(request, { [HUB_FIELDS.status]: "Dismissed" });
}

export async function reopenRequest(request: CampaignRequest) {
  await writeHub(request, { [HUB_FIELDS.status]: "New" });
}

// Sample mode only: one request from each form, for trying the screen without Airtable.
const SAMPLE_REQUESTS: CampaignRequest[] = [
  {
    id: "rqs01",
    source: "influencer",
    name: "'Back Roads' Fitness Creators",
    artist: "The Copper Hours",
    partners: ["Sample Management"],
    submitterEmail: "manager@example.com",
    billingName: "Accounts",
    billingEmail: "billing@example.com",
    status: "Todo",
    strategy: ["Song Awareness"],
    platforms: ["TikTok", "Instagram"],
    budget: 8000,
    launchDate: "2026-11-10",
    keyDate: "2026-11-14",
    sections: [
      { label: "Talking points and vision", text: "Morning runs and gym sessions with the chorus as the payoff." },
      { label: "Creators we're looking for", text: "Fitness creators, 50K–500K followers." },
      { label: "Posts requested", text: "10" },
    ],
    hubStatus: "New",
    hubCampaignIds: [],
    createdTime: new Date().toISOString(),
  },
  {
    id: "rqs02",
    source: "seeding",
    name: "Holiday Single Seeding",
    artist: "Ivy Lane",
    partners: ["Sample Records"],
    submitterEmail: "label@example.com",
    status: "Requested",
    strategy: ["Music promotion"],
    platforms: ["TikTok"],
    budget: 3000,
    launchDate: "2026-11-20",
    endDate: "2026-12-20",
    sections: [{ label: "Campaign vision", text: "Cosy holiday edits on repost pages." }],
    hubStatus: "New",
    hubCampaignIds: [],
    createdTime: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

