import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createRecords } from "@/lib/airtable";
import { POST_FIELDS as PF, TABLES, isSampleMode } from "@/lib/config";
import { getPosts } from "@/lib/data";
import { refreshStats } from "@/lib/refresh";
import { detectPlatform, postKey, PLATFORM_LABEL } from "@/lib/social";

export const maxDuration = 300;

const MAX_LINKS = 50;

type Skipped = { url: string; reason: "duplicate" | "unsupported" };

// Adds one or more live post links to a campaign, then pulls their first stats straight away.
export async function POST(req: Request) {
  if (isSampleMode()) {
    return NextResponse.json({ error: "Connect Airtable to add real posts." }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    urls?: string[];
    campaignId?: string;
    creatorId?: string;
    postedAt?: string;
  };
  const urls = (body.urls ?? (body.url ? [body.url] : [])).map((u) => u.trim()).filter(Boolean);
  if (!urls.length || !body.campaignId) {
    return NextResponse.json({ error: "Paste a post link." }, { status: 400 });
  }
  if (urls.length > MAX_LINKS) {
    return NextResponse.json({ error: `Add up to ${MAX_LINKS} links at a time.` }, { status: 400 });
  }

  // Skip links already on this campaign, repeats within the paste, and anything that isn't Instagram or TikTok.
  const existing = await getPosts({ fresh: true });
  const seen = new Set(existing.filter((p) => p.campaignId === body.campaignId).map((p) => postKey(p.url)));
  const skipped: Skipped[] = [];
  const toAdd: { url: string; platform: NonNullable<ReturnType<typeof detectPlatform>> }[] = [];
  for (const url of urls) {
    const platform = detectPlatform(url);
    if (!platform) {
      skipped.push({ url, reason: "unsupported" });
      continue;
    }
    const key = postKey(url);
    if (seen.has(key)) {
      skipped.push({ url, reason: "duplicate" });
      continue;
    }
    seen.add(key);
    toAdd.push({ url, platform });
  }

  if (!toAdd.length) {
    const error =
      urls.length === 1
        ? skipped[0].reason === "duplicate"
          ? "That post is already on this campaign."
          : "Only Instagram and TikTok links work for now."
        : "None of those links could be added: they're already on this campaign or aren't Instagram or TikTok links.";
    return NextResponse.json({ error, skipped }, { status: skipped.every((s) => s.reason === "duplicate") ? 409 : 400 });
  }

  const records = await createRecords(
    TABLES.posts,
    toAdd.map(({ url, platform }) => ({
      fields: {
        [PF.url]: url,
        [PF.platform]: PLATFORM_LABEL[platform],
        [PF.campaign]: [body.campaignId],
        ...(body.creatorId ? { [PF.creator]: [body.creatorId] } : {}),
        [PF.postedAt]: body.postedAt || new Date().toISOString().slice(0, 10),
        [PF.status]: "Live",
      },
    })),
  );

  let note: string | undefined;
  try {
    const result = await refreshStats({ postIds: records.map((r) => r.id) });
    if (result.errors.length) note = "Stats will fill in on the next refresh.";
    else if (result.missed.length) {
      note =
        records.length === 1
          ? "No stats came back. Check the post is public."
          : `No stats came back for ${result.missed.length}. Check those posts are public.`;
    }
  } catch {
    note = "Stats will fill in on the next refresh.";
  }

  revalidateTag("airtable");
  return NextResponse.json({ ok: true, added: records.length, ids: records.map((r) => r.id), skipped, note });
}
