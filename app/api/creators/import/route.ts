import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { importCreators } from "@/lib/creator-import";
import type { RawCreatorRow } from "@/lib/csv-import";

export const maxDuration = 300;

const MAX_ROWS = 5000;
const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 2000) : undefined);
const pairs = (v: unknown) =>
  Array.isArray(v)
    ? v
        .map((p) => (p ?? {}) as { label?: unknown; value?: unknown })
        .filter((p): p is { label: string; value: string } => typeof p.label === "string" && typeof p.value === "string")
        .map((p) => ({ label: p.label.slice(0, 60), value: p.value.slice(0, 300) }))
        .slice(0, 40)
    : undefined;
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.slice(0, 500)).slice(0, 50) : undefined);

// Team only (middleware). Previews (dryRun) or imports a batch of creators from a CSV.
export async function POST(req: Request) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to import creators." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { rows?: unknown[]; dryRun?: boolean; firstRow?: number };
  if (!Array.isArray(body.rows) || !body.rows.length) return NextResponse.json({ error: "The file has no rows." }, { status: 400 });
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Import up to ${MAX_ROWS.toLocaleString()} creators at a time. Split the file and try again.` }, { status: 400 });
  }

  const rows: RawCreatorRow[] = body.rows.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      name: str(o.name),
      instagram: str(o.instagram),
      tiktok: str(o.tiktok),
      links: strs(o.links),
      email: str(o.email),
      tags: strs(o.tags),
      location: str(o.location),
      rate: str(o.rate),
      notes: str(o.notes),
      instagramFollowers: str(o.instagramFollowers),
      tiktokFollowers: str(o.tiktokFollowers),
      extras: pairs(o.extras),
      platformRates: pairs(o.platformRates),
      currency: str(o.currency)?.slice(0, 10),
    };
  });

  const dryRun = body.dryRun !== false;
  const result = await importCreators(rows, {
    dryRun,
    firstRow: typeof body.firstRow === "number" && body.firstRow > 0 ? Math.floor(body.firstRow) : 1,
  });
  if (!dryRun) revalidateTag("airtable");
  return NextResponse.json({ ok: true, dryRun, ...result });
}
