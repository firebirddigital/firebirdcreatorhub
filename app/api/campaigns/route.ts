import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createCampaign, toFields } from "@/lib/campaigns";
import { isSampleMode } from "@/lib/config";

// Team only (middleware). Start a new campaign.
export async function POST(req: Request) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to create campaigns." }, { status: 400 });
  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { fields, error } = toFields({ name: "", ...input });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const { id, typeSaved } = await createCampaign(fields);
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, id, typeSaved });
}
