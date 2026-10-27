import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateRecords } from "@/lib/airtable";
import { CREATOR_FIELDS as CRF, TABLES, isSampleMode } from "@/lib/config";
import { cleanHandle } from "@/lib/roster";

const TEXT = { name: 120, location: 120, email: 200, notes: 5000 } as const;
const NUMBERS = ["instagramFollowers", "tiktokFollowers", "avgViews", "rate"] as const;

// Team only (middleware). Edits one creator's details in the Creators table, from a campaign page.
// Only the fields sent are changed; an empty value clears that field.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to edit creators." }, { status: 400 });
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) return NextResponse.json({ error: "Unknown creator." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: Record<string, unknown> = {};

  for (const [key, max] of Object.entries(TEXT) as [keyof typeof TEXT, number][]) {
    if (!(key in body)) continue;
    const v = typeof body[key] === "string" ? (body[key] as string).trim().slice(0, max) : "";
    if (key === "name" && !v) return NextResponse.json({ error: "Add the creator's name." }, { status: 400 });
    if (key === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return NextResponse.json({ error: "That email doesn't look right." }, { status: 400 });
    }
    fields[CRF[key]] = v || null;
  }
  for (const key of ["tiktok", "instagram"] as const) {
    if (key in body) fields[CRF[key]] = cleanHandle(typeof body[key] === "string" ? (body[key] as string) : "") ?? null;
  }
  for (const key of NUMBERS) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null || v === "") fields[CRF[key]] = null;
    else if (typeof v === "number" && isFinite(v) && v >= 0) fields[CRF[key]] = Math.round(v);
    else return NextResponse.json({ error: "Numbers can't be negative." }, { status: 400 });
  }
  if ("tags" in body) {
    fields[CRF.tags] = [
      ...new Set(
        (Array.isArray(body.tags) ? body.tags : [])
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().replace(/,/g, "").slice(0, 50))
          .filter(Boolean),
      ),
    ].slice(0, 30);
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  try {
    await updateRecords(TABLES.creators, [{ id, fields }]);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
  revalidateTag("airtable");
  return NextResponse.json({ ok: true });
}
