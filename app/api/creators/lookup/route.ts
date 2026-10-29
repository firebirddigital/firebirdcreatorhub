import { NextResponse } from "next/server";
import { fetchProfileStats } from "@/lib/apify";
import { isSampleMode } from "@/lib/config";
import { getCreators } from "@/lib/data";
import { profileFromUrl } from "@/lib/social";

export const maxDuration = 120;

// Team only (middleware). Looks up a TikTok or Instagram profile link: the display name,
// followers and average views, and whether that creator is already in the database.
export async function POST(req: Request) {
  const { url } = (await req.json().catch(() => ({}))) as { url?: string };
  const profile = typeof url === "string" ? profileFromUrl(url) : undefined;
  if (!profile) {
    return NextResponse.json(
      { error: "Paste a TikTok or Instagram profile link, like tiktok.com/@name or instagram.com/name." },
      { status: 400 },
    );
  }

  const roster = await getCreators({ fresh: !isSampleMode() });
  const existing = roster.find((c) => (profile.platform === "tiktok" ? c.tiktok : c.instagram)?.toLowerCase() === profile.handle);

  if (isSampleMode() || !process.env.APIFY_TOKEN) {
    return NextResponse.json({ ...profile, existing: existing && { id: existing.id, name: existing.name }, found: false });
  }

  try {
    const stats = (await fetchProfileStats([profile])).get(`${profile.platform}:${profile.handle}`);
    return NextResponse.json({
      ...profile,
      name: stats?.name,
      followers: stats?.followers,
      avgViews: stats?.avgViews,
      postsCounted: stats?.videos,
      found: Boolean(stats),
      existing: existing && { id: existing.id, name: existing.name },
    });
  } catch {
    // The handle alone is still useful; the team can type the name.
    return NextResponse.json({ ...profile, found: false, existing: existing && { id: existing.id, name: existing.name } });
  }
}
