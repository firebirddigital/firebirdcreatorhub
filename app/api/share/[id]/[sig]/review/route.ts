import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isValidShare } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { getAssignment, getCampaign, getDraft } from "@/lib/data";
import { notifyReview } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
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
    reviewerName?: string;
    reviewerEmail?: string;
  };
  const decision = DECISIONS.find((d) => d === body.decision);
  if (!decision || !body.recordId || (body.kind !== "creator" && body.kind !== "draft")) {
    return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  }
  // Every decision records who made it.
  const reviewerName = body.reviewerName?.trim().slice(0, 80) ?? "";
  const reviewerEmail = body.reviewerEmail?.trim().slice(0, 120) ?? "";
  if (reviewerName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail)) {
    return NextResponse.json({ error: "Add your name and work email so the team knows who reviewed this." }, { status: 400 });
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
    reviewer: `${reviewerName} <${reviewerEmail}>`,
  });
  revalidateTag("airtable");
  const origin = await siteOrigin();
  const kind = body.kind;
  const recordId = body.recordId;
  after(() =>
    notifyReview({ origin, campaignId: id, kind, recordId, decision, comment: body.comment, reviewer: `${reviewerName} <${reviewerEmail}>` }).catch(
      () => undefined,
    ),
  );
  return NextResponse.json({ ok: true });
}
