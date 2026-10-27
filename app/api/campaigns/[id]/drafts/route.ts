import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { getCampaign } from "@/lib/data";
import { checkDraftLink, isBlobUrl } from "@/lib/draft-links";
import { createDraft, ensureDraftAssignment, UserError } from "@/lib/roster";

const TEAM_SUBMITTER = "Firebird team";

// Team only (middleware). Adds a draft for any creator: one already on the campaign, one from
// the roster, or a brand new one. Fills in the roster entry if the Creators step was skipped.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to add drafts." }, { status: 400 });
  const { id } = await params;
  if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    assignmentId?: string;
    creatorId?: string;
    newCreator?: { name?: string; instagram?: string; tiktok?: string };
    videoUrl?: string;
    caption?: string;
  };

  const videoUrl = body.videoUrl?.trim() ?? "";
  let saved: string;
  let blob = false;
  try {
    blob = isBlobUrl(new URL(videoUrl));
  } catch {}
  if (blob) {
    // Team uploads go to drafts/team/<campaign>/ via the upload route next to this one.
    if (!new URL(videoUrl).pathname.startsWith(`/drafts/team/${id}/`)) {
      return NextResponse.json({ error: "Upload the file again." }, { status: 400 });
    }
    saved = videoUrl;
  } else {
    if (!videoUrl) return NextResponse.json({ error: "Paste a link to the draft or upload the file." }, { status: 400 });
    const link = checkDraftLink(videoUrl);
    if (!link.ok) return NextResponse.json({ error: link.error }, { status: 400 });
    saved = link.url;
  }

  try {
    const { assignment, createdCreator, addedToCampaign } = await ensureDraftAssignment(id, {
      assignmentId: body.assignmentId,
      creatorId: body.creatorId,
      newCreator: body.newCreator?.name ? { ...body.newCreator, name: body.newCreator.name } : undefined,
    });
    const version = await createDraft(assignment, saved, body.caption, TEAM_SUBMITTER);
    revalidateTag("airtable");
    return NextResponse.json({ ok: true, version, createdCreator, addedToCampaign });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
