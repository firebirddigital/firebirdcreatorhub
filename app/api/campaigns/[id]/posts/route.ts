import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { deleteRecords } from "@/lib/airtable";
import { isSampleMode, TABLES } from "@/lib/config";
import { getPosts, getSnapshots } from "@/lib/data";

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
