import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateRecords } from "@/lib/airtable";
import { CREATOR_FIELDS as CRF, TABLES, isSampleMode } from "@/lib/config";

const MAX_TAGS = 30;

// Team only (middleware). Sets the Tags on one or more creators. New tag names become new
// options on the Tags field (Airtable typecast), so the team can tag without opening Airtable.
export async function PATCH(req: Request) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to edit tags." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { updates?: { id?: string; tags?: unknown }[] };
  const updates = (body.updates ?? [])
    .filter((u): u is { id: string; tags: unknown } => typeof u.id === "string" && /^rec[A-Za-z0-9]{14}$/.test(u.id))
    .map((u) => ({
      id: u.id,
      tags: [
        ...new Set(
          (Array.isArray(u.tags) ? u.tags : [])
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().replace(/,/g, "").slice(0, 50))
            .filter(Boolean),
        ),
      ].slice(0, MAX_TAGS),
    }));
  if (!updates.length) return NextResponse.json({ error: "Pick at least one creator." }, { status: 400 });
  if (updates.length > 500) return NextResponse.json({ error: "Tag up to 500 creators at a time." }, { status: 400 });

  await updateRecords(
    TABLES.creators,
    updates.map((u) => ({ id: u.id, fields: { [CRF.tags]: u.tags } })),
  );
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, updated: updates.length });
}
