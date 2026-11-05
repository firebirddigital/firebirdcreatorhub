import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/data";
import { updateCampaignSettings } from "@/lib/campaign-settings";

// Team only (middleware). Per-campaign display switches, e.g. hiding current CPM everywhere.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const { showCurrentCpm } = (await req.json().catch(() => ({}))) as { showCurrentCpm?: unknown };
  if (typeof showCurrentCpm !== "boolean") return NextResponse.json({ error: "Say whether to show current CPM." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, ...(await updateCampaignSettings(id, { showCurrentCpm })) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
