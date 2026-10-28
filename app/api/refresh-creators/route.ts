import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { refreshOldestCreators } from "@/lib/creator-refresh";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Vercel Cron sends CRON_SECRET; a logged-in team member can also run it by hand.
async function authorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const jar = await cookies();
  return isValidSession(jar.get(SESSION_COOKIE)?.value);
}

// Nightly: followers and average views (last 10 posts) for the creators whose stats are oldest.
async function handle(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (isSampleMode() || !process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: "Connect Airtable and Apify to refresh creator stats." }, { status: 400 });
  }
  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), 40) : undefined; // a manual test can pass ?limit=
  try {
    const result = await refreshOldestCreators(limit);
    revalidateTag("airtable");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
