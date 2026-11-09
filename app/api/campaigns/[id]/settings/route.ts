import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/data";
import { type CampaignSettings, updateCampaignSettings } from "@/lib/campaign-settings";

const SWITCHES = ["showCurrentCpm", "showEngagementToPartners"] as const satisfies (keyof CampaignSettings)[];

// Team only (middleware). Per-campaign display switches, e.g. hiding current CPM everywhere.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const change: Partial<CampaignSettings> = {};
  for (const key of SWITCHES) if (typeof body[key] === "boolean") change[key] = body[key] as boolean;
  if (!Object.keys(change).length) return NextResponse.json({ error: "Say which setting to change." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await updateCampaignSettings(id, change)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
