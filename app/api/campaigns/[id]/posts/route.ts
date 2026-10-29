import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { deleteRecords, updateRecords } from "@/lib/airtable";
import { isSampleMode, POST_FIELDS as PF, TABLES } from "@/lib/config";
import { getCreators, getPosts, getSnapshots } from "@/lib/data";
import { addCreatorsToCampaign } from "@/lib/roster";

const MAX = 200;

// Team only (middleware). Deletes posts from a campaign, with their view history (snapshots),
// so they stop counting toward the campaign's totals and charts.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to delete posts." }, { status: 400 });
  const { id } = await params;
  const { postIds } = (await req.json().catch(() => ({}))) as { postIds?: unknown };
  const wanted = new Set((Array.isArray(postIds) ? postIds : []).filter((x): x is string => typeof x === "string"));
  if (!wanted.size) return NextResponse.json({ error: "Pick at least one post." }, { status: 400 });
  if (wanted.size > MAX) return NextResponse.json({ error: `Delete up to ${MAX} posts at a time.` }, { status: 400 });

  // Only posts that belong to this campaign.
  const posts = (await getPosts({ fresh: true })).filter((p) => p.campaignId === id && wanted.has(p.id));
  if (!posts.length) return NextResponse.json({ error: "None of those posts are on this campaign." }, { status: 404 });
  const postIdSet = new Set(posts.map((p) => p.id));
  const snapshots = (await getSnapshots(id)).filter((s) => postIdSet.has(s.postId));

  await deleteRecords(TABLES.posts, [...postIdSet]);
  if (snapshots.length) await deleteRecords(TABLES.snapshots, snapshots.map((s) => s.id));
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, removed: posts.length, snapshots: snapshots.length });
}

// Team only (middleware). Fixes a post by hand: who made it and when it went up. A creator who isn't
// on this campaign yet is added to its roster as approved, so their fee and CPM count.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return NextResponse.json({ error: "Connect Airtable to edit posts." }, { status: 400 });
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { postId?: string; creatorId?: string | null; postedAt?: string | null };
  const post = (await getPosts({ fresh: true })).find((p) => p.id === body.postId && p.campaignId === id);
  if (!post) return NextResponse.json({ error: "That post isn't on this campaign." }, { status: 404 });

  const fields: Record<string, unknown> = {};
  if ("creatorId" in body) {
    if (body.creatorId) {
      if (!(await getCreators()).some((c) => c.id === body.creatorId)) {
        return NextResponse.json({ error: "Pick a creator from the list." }, { status: 400 });
      }
      fields[PF.creator] = [body.creatorId];
    } else fields[PF.creator] = [];
  }
  if ("postedAt" in body) {
    if (body.postedAt && !/^\d{4}-\d{2}-\d{2}$/.test(body.postedAt)) {
      return NextResponse.json({ error: "Use a date like 2026-10-28." }, { status: 400 });
    }
    fields[PF.postedAt] = body.postedAt || null;
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: "Nothing to save." }, { status: 400 });

  await updateRecords(TABLES.posts, [{ id: post.id, fields }]);
  let addedToCampaign = 0;
  if (body.creatorId) addedToCampaign = await addCreatorsToCampaign(id, [body.creatorId], "Approved", "Firebird team");
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, addedToCampaign });
}
