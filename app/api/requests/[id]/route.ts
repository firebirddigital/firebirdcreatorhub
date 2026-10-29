import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { siteOrigin } from "@/lib/origin";
import { syncRequestStatus } from "@/lib/request-sync";
import {
  acceptAsNewCampaign,
  acceptIntoCampaign,
  dismissRequest,
  getRequest,
  reopenRequest,
  RequestSetupError,
} from "@/lib/requests";

// Team only (middleware). Acts on a synced campaign request: create a campaign from it, add it to
// an existing campaign, dismiss it, or put it back to New.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to act on requests." }, { status: 400 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; campaignId?: string };
  const request = await getRequest(id);
  if (!request) return NextResponse.json({ error: "That request isn't in the synced tables any more." }, { status: 404 });

  try {
    const origin = await siteOrigin();
    if (body.action === "create") {
      if (request.hubStatus === "Accepted") return NextResponse.json({ error: "This request was already accepted." }, { status: 409 });
      const { campaignId, contactsSaved } = await acceptAsNewCampaign(request);
      after(() => syncRequestStatus(request, "accepted", `${origin}/campaigns/${campaignId}`));
      revalidateTag("airtable");
      return NextResponse.json({ ok: true, campaignId, contactsSaved });
    }
    if (body.action === "link") {
      if (!body.campaignId || !/^rec[A-Za-z0-9]{14}$/.test(body.campaignId)) {
        return NextResponse.json({ error: "Pick a campaign." }, { status: 400 });
      }
      const { contactsSaved, filled } = await acceptIntoCampaign(request, body.campaignId);
      after(() => syncRequestStatus(request, "accepted", `${origin}/campaigns/${body.campaignId}`));
      revalidateTag("airtable");
      return NextResponse.json({ ok: true, campaignId: body.campaignId, contactsSaved, filled });
    }
    if (body.action === "dismiss") {
      await dismissRequest(request);
      revalidateTag("airtable");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "reopen") {
      await reopenRequest(request);
      revalidateTag("airtable");
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    if (e instanceof RequestSetupError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
