import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { refreshCreatorStats } from "@/lib/roster";

export const maxDuration = 300;

// Small batches keep each scraper run well inside the time limit; the page sends several in a row.
const MAX_PER_REQUEST = 10;

// Team only (middleware). Pulls followers and average views (last 10 posts) for the given creators.
export async function POST(req: Request) {
  if (isSampleMode() || !process.env.APIFY_TOKEN) {
    return NextResponse.json({ error: "Connect Airtable and Apify to pull creator stats." }, { status: 400 });
  }
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const creatorIds = (Array.isArray(ids) ? ids : []).filter(
    (x): x is string => typeof x === "string" && /^rec[A-Za-z0-9]{14}$/.test(x),
  );
  if (!creatorIds.length) return NextResponse.json({ error: "Pick at least one creator." }, { status: 400 });
  if (creatorIds.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `Send up to ${MAX_PER_REQUEST} creators per request.` }, { status: 400 });
  }
  try {
    const result = await refreshCreatorStats(creatorIds);
    revalidateTag("airtable");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
