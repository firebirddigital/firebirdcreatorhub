import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { del } from "@vercel/blob";
import { deleteRecords } from "@/lib/airtable";
import { isPrivateBlobUrl, privateBlobToken } from "@/lib/blob";
import { isSampleMode, TABLES } from "@/lib/config";
import { getCampaign, getDrafts } from "@/lib/data";
import { checkDraftLink, isBlobUrl } from "@/lib/draft-links";
import { notifyDraftSubmitted, notifyReview } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { parsePlatforms } from "@/lib/types";
import { createDraft, ensureDraftAssignment, pullMissingStats, recordReview, refreshCreatorStats, UserError } from "@/lib/roster";

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
    platforms?: unknown;
  };
  const platforms = parsePlatforms(Array.isArray(body.platforms) ? body.platforms.filter((p) => typeof p === "string") : []);

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
    const { version, platformsSaved } = await createDraft(assignment, saved, body.caption, TEAM_SUBMITTER, platforms);
    revalidateTag("airtable");
    const origin = await siteOrigin();
    after(() =>
      notifyDraftSubmitted({ origin, campaignId: id, assignmentId: assignment.id, version, byTeam: true }).catch(() => undefined),
    );
    // A creator with no stats yet (brand new, or never pulled) gets followers and median views
    // (last 10 posts) pulled after responding.
    if (assignment.creatorId && process.env.APIFY_TOKEN) {
      const creatorId = assignment.creatorId;
      after(async () => {
        await (createdCreator ? refreshCreatorStats([creatorId]) : pullMissingStats([creatorId])).catch(() => undefined);
        revalidateTag("airtable");
      });
    }
    return NextResponse.json({ ok: true, version, createdCreator, addedToCampaign, platformsSaved });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

// Team only (middleware). Deletes draft versions: one (?draft=) or several ({ draftIds }). A video
// uploaded to the hub is deleted too; a draft that's a link (Dropbox, Drive and so on) only loses the link.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to delete drafts." }, { status: 400 });
  const { id } = await params;
  const one = new URL(req.url).searchParams.get("draft");
  const body = one ? {} : ((await req.json().catch(() => ({}))) as { draftIds?: unknown });
  const wanted = new Set(one ? [one] : (Array.isArray(body.draftIds) ? body.draftIds : []).filter((x): x is string => typeof x === "string"));
  if (!wanted.size) return NextResponse.json({ error: "Pick at least one draft." }, { status: 400 });
  if (wanted.size > 200) return NextResponse.json({ error: "Delete up to 200 drafts at a time." }, { status: 400 });
  const drafts = (await getDrafts(id, { fresh: true })).filter((d) => wanted.has(d.id));
  if (!drafts.length) return NextResponse.json({ error: "That draft isn't on this campaign." }, { status: 404 });

  await deleteRecords(TABLES.drafts, drafts.map((d) => d.id));

  let failedFiles = 0;
  for (const draft of drafts) {
    if (!draft.videoUrl) continue;
    try {
      const url = new URL(draft.videoUrl);
      if (isBlobUrl(url) && url.pathname.startsWith("/drafts/")) {
        const token = isPrivateBlobUrl(draft.videoUrl) ? privateBlobToken() : process.env.BLOB_READ_WRITE_TOKEN;
        await del(draft.videoUrl, { token });
      }
    } catch {
      failedFiles++;
    }
  }
  revalidateTag("airtable");
  return NextResponse.json({
    ok: true,
    removed: drafts.length,
    fileNote: failedFiles ? "The drafts are deleted, but some video files couldn't be removed from storage." : undefined,
  });
}

// Team only (middleware). Approve a draft or request changes from the team side, for example when a
// partner gives the decision by email. Recorded as "Firebird team", or "<name> (via Firebird team)".
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to review drafts." }, { status: 400 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { draftId?: string; decision?: string; comment?: string; onBehalfOf?: string };
  const decision = body.decision === "approve" || body.decision === "changes" ? body.decision : undefined;
  if (!decision || !body.draftId) return NextResponse.json({ error: "Something was missing. Try again." }, { status: 400 });
  if (decision === "changes" && !body.comment?.trim()) {
    return NextResponse.json({ error: "Add a note so the creator knows what to change." }, { status: 400 });
  }
  const draft = (await getDrafts(id, { fresh: true })).find((d) => d.id === body.draftId);
  if (!draft) return NextResponse.json({ error: "That draft isn't on this campaign." }, { status: 404 });

  const who = body.onBehalfOf?.trim().replace(/[<>]/g, "").slice(0, 80);
  const reviewer = who ? `${who} (via Firebird team)` : "Firebird team";
  await recordReview({ kind: "draft", recordId: draft.id, decision, comment: body.comment, reviewer });
  revalidateTag("airtable");
  const origin = await siteOrigin();
  // Same follow-ups as a partner decision: the team hears about it, and on changes the creator gets the notes.
  after(() =>
    notifyReview({ origin, campaignId: id, kind: "draft", recordId: draft.id, decision, comment: body.comment, reviewer }).catch(() => undefined),
  );
  return NextResponse.json({ ok: true });
}
