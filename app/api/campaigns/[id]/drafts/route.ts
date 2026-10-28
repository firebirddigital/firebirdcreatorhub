import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { del } from "@vercel/blob";
import { deleteRecords } from "@/lib/airtable";
import { isPrivateBlobUrl, privateBlobToken } from "@/lib/blob";
import { isSampleMode, TABLES } from "@/lib/config";
import { getCampaign, getDrafts } from "@/lib/data";
import { checkDraftLink, isBlobUrl } from "@/lib/draft-links";
import { notifyDraftSubmitted } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { createDraft, ensureDraftAssignment, refreshCreatorStats, UserError } from "@/lib/roster";

const TEAM_SUBMITTER = "Firebird team";

export const maxDuration = 300;

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
    const origin = await siteOrigin();
    after(() =>
      notifyDraftSubmitted({ origin, campaignId: id, assignmentId: assignment.id, version, byTeam: true }).catch(() => undefined),
    );
    // A brand new creator gets followers and average views (last 20 posts) pulled after responding.
    if (createdCreator && assignment.creatorId && process.env.APIFY_TOKEN) {
      const creatorId = assignment.creatorId;
      after(async () => {
        await refreshCreatorStats([creatorId]).catch(() => undefined);
        revalidateTag("airtable");
      });
    }
    return NextResponse.json({ ok: true, version, createdCreator, addedToCampaign });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// Team only (middleware). Deletes one draft version. A video uploaded to the hub is deleted too;
// a draft that's a link (Dropbox, Drive and so on) only loses the link here.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to delete drafts." }, { status: 400 });
  const { id } = await params;
  const draftId = new URL(req.url).searchParams.get("draft") ?? "";
  const draft = (await getDrafts(id, { fresh: true })).find((d) => d.id === draftId);
  if (!draft) return NextResponse.json({ error: "That draft isn't on this campaign." }, { status: 404 });

  await deleteRecords(TABLES.drafts, [draft.id]);

  let fileNote: string | undefined;
  if (draft.videoUrl) {
    try {
      const url = new URL(draft.videoUrl);
      if (isBlobUrl(url) && url.pathname.startsWith("/drafts/")) {
        const token = isPrivateBlobUrl(draft.videoUrl) ? privateBlobToken() : process.env.BLOB_READ_WRITE_TOKEN;
        await del(draft.videoUrl, { token });
      }
    } catch {
      fileNote = "The draft is deleted, but its video file couldn't be removed from storage.";
    }
  }
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, fileNote });
}
