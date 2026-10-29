import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { refreshStats } from "@/lib/refresh";
import { importNewRequests } from "@/lib/requests";

// Scraper runs can take a while. Vercel allows up to 300s with Fluid Compute (the default).
export const maxDuration = 300;
export const dynamic = "force-dynamic";

async function authorized(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  const jar = await cookies();
  return isValidSession(jar.get(SESSION_COOKIE)?.value);
}

async function handle(req: Request) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaignId = new URL(req.url).searchParams.get("campaign") ?? undefined;
  try {
    const result = await refreshStats({ campaignId });
    // The daily run also picks up any request form submissions nobody has opened the hub for yet.
    const requests = campaignId ? undefined : await importNewRequests({ force: true }).catch((e) => ({ error: String(e) }));
    revalidateTag("airtable");
    return NextResponse.json({ ...result, requests });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Vercel Cron calls GET; the "Refresh stats" button calls POST.
export const GET = handle;
export const POST = handle;
