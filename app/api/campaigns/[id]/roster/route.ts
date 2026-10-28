import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { getAssignment, getCampaign } from "@/lib/data";
import {
  addCreatorsToCampaign,
  findOrCreateCreator,
  type NewCreatorInput,
  pullMissingStats,
  refreshCreatorStats,
  removeFromCampaign,
  updateAssignment,
  UserError,
} from "@/lib/roster";
import type { AssignmentStatus } from "@/lib/types";

export const maxDuration = 300;

const sampleBlock = () => NextResponse.json({ error: "Connect Airtable to change the roster." }, { status: 400 });

// Team only (middleware). Add creators to a campaign's roster: existing ones by ID, and new ones,
// which go into the Creators database first (or match an existing creator by handle).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return sampleBlock();
  const { id } = await params;
  // Check the campaign first so a new creator isn't saved for a campaign that doesn't exist.
  if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { creatorIds?: string[]; newCreator?: Partial<NewCreatorInput> };
  const creatorIds = (body.creatorIds ?? []).filter((c) => typeof c === "string" && /^rec[A-Za-z0-9]{14}$/.test(c));

  let created: { id: string; created: boolean; name: string } | undefined;
  if (body.newCreator) {
    const n = body.newCreator;
    try {
      created = await findOrCreateCreator(
        {
          name: typeof n.name === "string" ? n.name : "",
          instagram: typeof n.instagram === "string" ? n.instagram : undefined,
          tiktok: typeof n.tiktok === "string" ? n.tiktok : undefined,
          tags: Array.isArray(n.tags) ? n.tags.filter((t): t is string => typeof t === "string") : undefined,
          rate: typeof n.rate === "number" && isFinite(n.rate) ? n.rate : undefined,
          email: typeof n.email === "string" ? n.email : undefined,
          location: typeof n.location === "string" ? n.location : undefined,
          instagramFollowers: typeof n.instagramFollowers === "number" ? n.instagramFollowers : undefined,
          tiktokFollowers: typeof n.tiktokFollowers === "number" ? n.tiktokFollowers : undefined,
          avgViews: typeof n.avgViews === "number" ? n.avgViews : undefined,
        },
        "Added from a campaign.",
      );
    } catch (e) {
      if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
      throw e;
    }
    creatorIds.push(created.id);
  }
  if (!creatorIds.length) return NextResponse.json({ error: "Pick at least one creator." }, { status: 400 });

  const added = await addCreatorsToCampaign(id, creatorIds);
  revalidateTag("airtable");

  // Pull followers and average views (last 10 posts) after responding, unless the profile link
  // lookup already supplied them for a single platform.
  const n = body.newCreator;
  const hasHandle = Boolean(n?.instagram || n?.tiktok);
  const lookedUp = typeof n?.avgViews === "number" && !(n?.instagram && n?.tiktok);
  if (created && hasHandle && !lookedUp && process.env.APIFY_TOKEN) {
    const creatorId = created.id;
    after(async () => {
      await refreshCreatorStats([creatorId]).catch(() => undefined);
      revalidateTag("airtable");
    });
  }
  // Roster creators who have never had stats pulled get them now, so their median views and CPM show.
  const fromRoster = creatorIds.filter((c) => c !== created?.id);
  if (fromRoster.length && process.env.APIFY_TOKEN) {
    after(async () => {
      await pullMissingStats(fromRoster).catch(() => undefined);
      revalidateTag("airtable");
    });
  }
  return NextResponse.json({ ok: true, added, newCreator: created, pullingStats: Boolean(created && hasHandle && !lookedUp) });
}

const STATUSES: AssignmentStatus[] = ["Proposed", "Approved", "Changes requested", "Declined"];

// Change a roster entry's status or fee.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return sampleBlock();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { assignmentId?: string; status?: string; fee?: number | null; paid?: unknown };
  const assignment = body.assignmentId ? await getAssignment(body.assignmentId) : undefined;
  if (!assignment || assignment.campaignId !== id) {
    return NextResponse.json({ error: "That creator isn't on this campaign." }, { status: 404 });
  }
  const status = STATUSES.find((s) => s === body.status);
  const fee = body.fee === null ? null : typeof body.fee === "number" && body.fee >= 0 ? body.fee : undefined;
  const paid = typeof body.paid === "boolean" ? body.paid : undefined;
  try {
    await updateAssignment(assignment.id, { status, fee, paid });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  revalidateTag("airtable");
  return NextResponse.json({ ok: true });
}

// Takes creators off this campaign (they stay in the Creators database).
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return sampleBlock();
  const { id } = await params;
  const { assignmentIds } = (await req.json().catch(() => ({}))) as { assignmentIds?: unknown };
  const ids = (Array.isArray(assignmentIds) ? assignmentIds : []).filter((x): x is string => typeof x === "string");
  if (!ids.length) return NextResponse.json({ error: "Pick at least one creator." }, { status: 400 });
  if (ids.length > 200) return NextResponse.json({ error: "Remove up to 200 creators at a time." }, { status: 400 });
  try {
    const removed = await removeFromCampaign(id, ids);
    revalidateTag("airtable");
    return NextResponse.json({ ok: true, removed });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
