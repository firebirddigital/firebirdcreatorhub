// CSV reading and column matching for the creator import. Safe for client and server.

/** Parses CSV (or semicolon/tab separated) text, handling quotes, escaped quotes and line breaks in cells. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? undefined : src.search(/\r?\n/));
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export type ImportField =
  | "skip"
  | "name"
  | "instagram"
  | "tiktok"
  | "link"
  | "email"
  | "tags"
  | "location"
  | "rate"
  | "notes"
  | "instagramFollowers"
  | "tiktokFollowers"
  | "note"
  | "platformRate"
  | "currency";

export const FIELD_LABELS: Record<ImportField, string> = {
  skip: "Don't import",
  name: "Name",
  instagram: "Instagram (handle or link)",
  tiktok: "TikTok (handle or link)",
  link: "Profile link (any platform)",
  email: "Email",
  tags: "Tags",
  location: "Location",
  rate: "Rate",
  notes: "Notes",
  instagramFollowers: "Instagram followers",
  tiktokFollowers: "TikTok followers",
  note: "Add to notes (with its heading)",
  platformRate: "A platform rate (goes in notes)",
  currency: "Currency of the rates",
};

// Header words that point at each field. Checked in this order, so "tiktok followers" wins over "tiktok".
const HEADER_HINTS: [ImportField, RegExp][] = [
  // Rates for one platform or format, e.g. "TikTok Video Rate", "Instagram Story Rate", "Twitter / X Post Rate"
  ["platformRate", /^(tik ?tok|tt|instagram|insta|ig|youtube|yt|twitter|x|twitter x)\b.*\b(rate|price|fee)$/],
  ["currency", /^currency$/],
  // Details with no field of their own in Airtable: kept in Notes with their heading
  ["note", /^(youtube|yt|twitter|x|twitter x|gender|phone|phone number|mobile|primary platform|tik ?tok \d+|instagram \d+|tiktok backup|secondary tiktok)$/],
  ["instagramFollowers", /^(ig|insta(gram)?)\s*(followers|follower count|fans)$/],
  ["tiktokFollowers", /^(tt|tik ?tok)\s*(followers|follower count|fans)$/],
  ["instagram", /^(ig|insta(gram)?)(\s*(handle|link|url|profile|username|account))?$/],
  ["tiktok", /^(tt|tik ?tok)(\s*(handle|link|url|profile|username|account))?$/],
  ["link", /^(profile|social|link|url|profile link|profile url|social link|socials|handle|username|account)s?$/],
  ["name", /^(name|creator|creator name|influencer|influencer name|full name|display name|talent)$/],
  ["email", /^(e-?mail|email address|contact|contact email)$/],
  ["tags", /^(tags?|niches?|categor(y|ies)|genres?|verticals?|themes?|labels?|type)$/],
  ["location", /^(location|city|country|state|region|based in|market)$/],
  ["rate", /^(rate|rates|price|fee|cost|rate per post|price per post)$/],
  ["notes", /^(notes?|comments?|bio|description)$/],
];

export function guessField(header: string): ImportField {
  // "Instagram (Handle or URL)" → "instagram", "Twitter / X" → "twitter x", "TikTok #2" → "tiktok 2"
  const h = header
    .trim()
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_:/#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return HEADER_HINTS.find(([, re]) => re.test(h))?.[0] ?? "skip";
}

/** One creator as read from the file, before any cleaning. Tags can come from several columns. */
export interface RawCreatorRow {
  name?: string;
  instagram?: string;
  tiktok?: string;
  links?: string[];
  email?: string;
  tags?: string[];
  location?: string;
  rate?: string;
  notes?: string;
  instagramFollowers?: string;
  tiktokFollowers?: string;
  /** Columns kept in Notes, as "Heading: value". */
  extras?: { label: string; value: string }[];
  /** Per-platform rates, kept in Notes on one line. */
  platformRates?: { label: string; value: string }[];
  currency?: string;
}

/** Tags in a cell can be separated by commas, semicolons, pipes or line breaks. */
export const splitTags = (v: string) =>
  v
    .split(/[,;|\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

/** "Instagram (Handle or URL)" → "Instagram", "TikTok Video Rate" → "TikTok Video". */
const cleanLabel = (h: string, dropRate = false) => {
  const l = h.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  return dropRate ? l.replace(/\s*(rate|price|fee)$/i, "").trim() : l;
};

export function toRawRows(rows: string[][], mapping: ImportField[], headers: string[] = []): RawCreatorRow[] {
  return rows.map((cells) => {
    const out: RawCreatorRow = {};
    mapping.forEach((field, i) => {
      const v = (cells[i] ?? "").trim();
      if (!v || field === "skip") return;
      if (field === "tags") out.tags = [...(out.tags ?? []), ...splitTags(v)];
      else if (field === "link") out.links = [...(out.links ?? []), ...v.split(/[\s,]+/).filter(Boolean)];
      else if (field === "note") out.extras = [...(out.extras ?? []), { label: cleanLabel(headers[i] ?? `Column ${i + 1}`), value: v }];
      else if (field === "platformRate")
        out.platformRates = [...(out.platformRates ?? []), { label: cleanLabel(headers[i] ?? `Column ${i + 1}`, true), value: v }];
      else out[field] = v;
    });
    return out;
  });
}

export const TEMPLATE_CSV =
  "Profile URL,Primary Platform,Instagram (Handle or URL),TikTok (Handle or URL),YouTube (Channel or URL),Twitter / X (Handle or URL),Name,Gender,Email,Phone,TikTok #2 (Handle or URL),Location,Notes,Tags,Rate (General / Base),TikTok Rate,TikTok Video Rate,TikTok Story Rate,TikTok Song Promo Rate,TikTok Brand Promo Rate,Instagram Rate,Instagram Reel Rate,Instagram Story Rate,Instagram Feed Post Rate,YouTube Rate,YouTube Video Rate,YouTube Short Rate,YouTube Integrated Rate,Twitter / X Post Rate,Currency\n" +
  'https://instagram.com/creator_handle,TikTok,creator_ig,@creator_tt,creator_yt,creator_x,Jane Doe,Female,jane@example.com,+1-555-0100,@creator_tt_backup,"Los Angeles, CA, USA",Prefers email,"fitness, lifestyle",1500,1200,1500,500,800,1800,1000,1400,450,900,3000,3500,1200,2000,350,USD\n';

/**
 * Daily streams from a Spotify for Artists export (or any sheet with a date column and a streams column).
 * Accepts YYYY-MM-DD, M/D/YYYY and D Mon YYYY dates; numbers can have commas.
 */
export function parseStreamsCsv(text: string): { days: { date: string; streams: number }[]; skipped: number; error?: string } {
  const rows = parseCsv(text);
  if (rows.length < 2) return { days: [], skipped: 0, error: "That file has no rows under the header." };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const dateCol = header.findIndex((h) => /date|day/.test(h));
  const streamsCol = header.findIndex((h) => /stream/.test(h));
  if (dateCol < 0 || streamsCol < 0) {
    return { days: [], skipped: 0, error: "Couldn't find a date column and a streams column. Use the song's CSV download from Spotify for Artists." };
  }
  const days: { date: string; streams: number }[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = toIsoDate(r[dateCol] ?? "");
    const streams = Number((r[streamsCol] ?? "").replace(/[,\s]/g, ""));
    if (date && isFinite(streams) && streams >= 0) days.push({ date, streams: Math.round(streams) });
    else skipped++;
  }
  return { days, skipped, error: days.length ? undefined : "No rows had both a date and a number of streams." };
}

function toIsoDate(v: string): string | undefined {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) return `${m[3].length === 2 ? `20${m[3]}` : m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const t = Date.parse(s);
  return isNaN(t) ? undefined : new Date(t).toISOString().slice(0, 10);
}
