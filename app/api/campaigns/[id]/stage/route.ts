import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { siteOrigin } from "@/lib/origin";
import { syncCampaignRequests } from "@/lib/request-sync";
import { setStage } from "@/lib/roster";
import type { Stage } from "@/lib/types";

const STAGES: Stage[] = ["creators", "drafts", "live"];

// Team only (middleware). Moves the campaign (and its share link) to a stage.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to change stages." }, { status: 400 });
  const { id } = await params;
  const { stage } = (await req.json().catch(() => ({}))) as { stage?: string };
  const s = STAGES.find((x) => x === stage);
  if (!s) return NextResponse.json({ error: "Unknown stage." }, { status: 400 });
  await setStage(id, s);
  revalidateTag("airtable");
  if (s === "live") {
    const origin = await siteOrigin();
    after(() => syncCampaignRequests(id, "live", `${origin}/campaigns/${id}`));
  }
  return NextResponse.json({ ok: true });
}
