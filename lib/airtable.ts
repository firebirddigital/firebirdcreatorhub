// Server-side only: never import this from a "use client" component (it reads your Airtable token).

const API = "https://api.airtable.com/v0";

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function tableUrl(table: string) {
  return `${API}/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(table)}`;
}

/** Reads every record in a table, following Airtable's pagination. Cached for 5 minutes. */
export async function listAll(
  table: string,
  params: Record<string, string> = {},
  opts: { fresh?: boolean } = {},
): Promise<AirtableRecord[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "100", ...params });
    if (offset) qs.set("offset", offset);
    const res = await fetch(`${tableUrl(table)}?${qs}`, {
      headers: headers(),
      ...(opts.fresh ? { cache: "no-store" as const } : { next: { revalidate: 300, tags: ["airtable"] } }),
    });
    if (!res.ok) {
      throw new Error(`Airtable ${table} read failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function writeInChunks(
  table: string,
  method: "POST" | "PATCH",
  records: { id?: string; fields: Record<string, unknown> }[],
): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records.slice(i, i + 10);
    const res = await fetch(tableUrl(table), {
      method,
      headers: headers(),
      body: JSON.stringify({ records: chunk, typecast: true }),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Airtable ${table} write failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { records: AirtableRecord[] };
    out.push(...data.records);
    // Airtable allows 5 requests per second per base
    if (i + 10 < records.length) await new Promise((r) => setTimeout(r, 220));
  }
  return out;
}

export function createRecords(table: string, records: { fields: Record<string, unknown> }[]) {
  return writeInChunks(table, "POST", records);
}

export function updateRecords(
  table: string,
  records: { id: string; fields: Record<string, unknown> }[],
) {
  return writeInChunks(table, "PATCH", records);
}

// Small helpers for reading loosely typed Airtable fields
export const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
export const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : 0);
export const ids = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
export const strings = (v: unknown) =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is string => typeof x === "string") : [];
export function firstAttachment(v: unknown): string | undefined {
  if (!Array.isArray(v) || !v.length) return undefined;
  const a = v[0] as { url?: string; thumbnails?: { large?: { url?: string } } };
  return a.thumbnails?.large?.url ?? a.url;
}
