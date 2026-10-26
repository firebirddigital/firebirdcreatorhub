import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isValidShare } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { getAssignment, getCampaign, getDraft } from "@/lib/data";
import { type Decision, recordReview } from "@/lib/roster";

const DECISIONS: Decision[] = ["approve", "changes", "decline"];

// Partner approvals from the share link. The signed link is the credential, so every request
// re-checks the signature, that sharing is on, and that the record belongs to this campaign.
export async function POST(req: Request, { params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params;
  if (!(await isValidShare(id, sig))) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (isSampleMode()) {
    return NextResponse.json({ error: "This is a sample campaign, so approvals aren't saved." }, { status: 400 });
  }
  const campaign = await getCampaign(id);
  if (!campaign?.sharingEnabled) return NextResponse.json({ error: "Sharing is off for this campaign." }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    recordId?: string;
    decision?: string;
    comment?: string;
    reviewer?: string;
  };
  const decision = DECISIONS.find((d) => d === body.decision);
  if (!decision || !body.recordId || (body.kind !== "creator" && body.kind !== "draft")) {
    return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  }
  if (decision !== "approve" && !body.comment?.trim()) {
    return NextResponse.json({ error: "Add a note so the team knows what to change." }, { status: 400 });
  }

  const record = body.kind === "creator" ? await getAssignment(body.recordId) : await getDraft(body.recordId);
  if (!record || record.campaignId !== id) {
    return NextResponse.json({ error: "That item isn't part of this campaign." }, { status: 404 });
  }

  await recordReview({
    kind: body.kind,
    recordId: body.recordId,
    decision,
    comment: body.comment,
    reviewer: body.reviewer,
  });
  revalidateTag("airtable");
  return NextResponse.json({ ok: true });
}
