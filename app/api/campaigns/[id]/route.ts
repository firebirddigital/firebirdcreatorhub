import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { toFields, updateCampaign } from "@/lib/campaigns";
import { isSampleMode } from "@/lib/config";
import { getCampaign } from "@/lib/data";
import { siteOrigin } from "@/lib/origin";
import { syncCampaignRequests } from "@/lib/request-sync";

// Team only (middleware). Edit a campaign's details.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to edit campaigns." }, { status: 400 });
  const { id } = await params;
  if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const input = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { fields, error } = toFields(input);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (!Object.keys(fields).length) return NextResponse.json({ ok: true });

  const before = await getCampaign(id);
  const { typeSaved } = await updateCampaign(id, fields);
  revalidateTag("airtable");
  // Marking a campaign Wrapped (or Live) moves its original request along in the operations base.
  const status = input.status;
  if ((status === "Wrapped" || status === "Live") && before?.status !== status) {
    const origin = await siteOrigin();
    after(() => syncCampaignRequests(id, status === "Wrapped" ? "wrapped" : "live", `${origin}/campaigns/${id}`));
  }
  return NextResponse.json({ ok: true, typeSaved });
}
