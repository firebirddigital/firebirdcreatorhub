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
  | "tiktokFollowers";

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
};

// Header words that point at each field. Checked in this order, so "tiktok followers" wins over "tiktok".
const HEADER_HINTS: [ImportField, RegExp][] = [
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
  const h = header.trim().toLowerCase().replace(/[_:]+/g, " ").replace(/\s+/g, " ");
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
}

/** Tags in a cell can be separated by commas, semicolons, pipes or line breaks. */
export const splitTags = (v: string) =>
  v
    .split(/[,;|\n]+/)
    .map((t) => t.trim())
    .filter(Boolean);

export function toRawRows(rows: string[][], mapping: ImportField[]): RawCreatorRow[] {
  return rows.map((cells) => {
    const out: RawCreatorRow = {};
    mapping.forEach((field, i) => {
      const v = (cells[i] ?? "").trim();
      if (!v || field === "skip") return;
      if (field === "tags") out.tags = [...(out.tags ?? []), ...splitTags(v)];
      else if (field === "link") out.links = [...(out.links ?? []), ...v.split(/[\s,]+/).filter(Boolean)];
      else out[field] = v;
    });
    return out;
  });
}

export const TEMPLATE_CSV =
  "Name,Instagram,TikTok,Email,Tags,Location,Rate,Notes\n" +
  'Jane Example,instagram.com/janeexample,@janeexample,jane@example.com,"Country, Lifestyle","Nashville, TN",500,Met at CMA Fest\n';
