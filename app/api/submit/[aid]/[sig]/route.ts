import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isValidSubmit } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { getAssignment } from "@/lib/data";
import { checkDraftLink, isBlobUrl } from "@/lib/draft-links";
import { notifyDraftSubmitted } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { createDraft, pullMissingStats } from "@/lib/roster";

export const maxDuration = 300;

// Saves a draft (an uploaded file or a share link) against the creator's roster entry.
export async function POST(req: Request, { params }: { params: Promise<{ aid: string; sig: string }> }) {
  const { aid, sig } = await params;
  if (!(await isValidSubmit(aid, sig))) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (isSampleMode()) return NextResponse.json({ error: "Uploads are off in sample mode." }, { status: 400 });

  const assignment = await getAssignment(aid);
  if (!assignment || assignment.status === "Declined") {
    return NextResponse.json({ error: "This upload link is no longer active." }, { status: 403 });
  }

  const { videoUrl, caption } = (await req.json().catch(() => ({}))) as { videoUrl?: string; caption?: string };
  if (!videoUrl?.trim()) return NextResponse.json({ error: "Paste a link to your draft or upload the file." }, { status: 400 });

  // Uploaded files must sit in our Blob store under this creator's folder; anything else is a share link.
  let saved: string;
  let blob = false;
  try {
    blob = isBlobUrl(new URL(videoUrl));
  } catch {}
  if (blob) {
    if (!new URL(videoUrl).pathname.startsWith(`/drafts/${aid}/`)) {
      return NextResponse.json({ error: "Upload the video first." }, { status: 400 });
    }
    saved = videoUrl;
  } else {
    const link = checkDraftLink(videoUrl);
    if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 });
    saved = link.url;
  }

  const { version } = await createDraft(assignment, saved, caption);
  revalidateTag("airtable");
  const origin = await siteOrigin();
  after(() => notifyDraftSubmitted({ origin, campaignId: assignment.campaignId, assignmentId: assignment.id, version }).catch(() => undefined));
  // A creator who has never had stats pulled gets them now, so the team sees their median views and CPM.
  if (assignment.creatorId) {
    const creatorId = assignment.creatorId;
    after(async () => {
      await pullMissingStats([creatorId]).catch(() => undefined);
      revalidateTag("airtable");
    });
  }
  return NextResponse.json({ ok: true, version });
}
