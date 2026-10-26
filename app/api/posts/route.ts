import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createRecords } from "@/lib/airtable";
import { POST_FIELDS as PF, TABLES, isSampleMode } from "@/lib/config";
import { getPosts } from "@/lib/data";
import { refreshStats } from "@/lib/refresh";
import { detectPlatform, postKey, PLATFORM_LABEL } from "@/lib/social";

export const maxDuration = 300;

// Adds a live post link to a campaign, then pulls its first stats straight away.
export async function POST(req: Request) {
  if (isSampleMode()) {
    return NextResponse.json({ error: "Connect Airtable to add real posts." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    campaignId?: string;
    creatorId?: string;
    postedAt?: string;
  };
  const url = body.url?.trim();
  if (!url || !body.campaignId) {
    return NextResponse.json({ error: "Paste a post link." }, { status: 400 });
  }
  const platform = detectPlatform(url);
  if (!platform) {
    return NextResponse.json({ error: "Only Instagram and TikTok links work for now." }, { status: 400 });
  }

  const existing = await getPosts({ fresh: true });
  if (existing.some((p) => p.campaignId === body.campaignId && postKey(p.url) === postKey(url))) {
    return NextResponse.json({ error: "That post is already on this campaign." }, { status: 409 });
  }

  const [record] = await createRecords(TABLES.posts, [
    {
      fields: {
        [PF.url]: url,
        [PF.platform]: PLATFORM_LABEL[platform],
        [PF.campaign]: [body.campaignId],
        ...(body.creatorId ? { [PF.creator]: [body.creatorId] } : {}),
        [PF.postedAt]: body.postedAt || new Date().toISOString().slice(0, 10),
        [PF.status]: "Live",
      },
    },
  ]);

  let note: string | undefined;
  try {
    const result = await refreshStats({ postIds: [record.id] });
    if (result.errors.length) note = "Saved. Stats will fill in on the next refresh.";
    else if (result.missed.length) note = "Saved, but no stats came back. Check the post is public.";
  } catch {
    note = "Saved. Stats will fill in on the next refresh.";
  }

  revalidateTag("airtable");
  return NextResponse.json({ ok: true, id: record.id, note });
}
