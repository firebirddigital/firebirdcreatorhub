import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { getAssignments } from "@/lib/data";
import { refreshCreatorStats } from "@/lib/roster";

export const maxDuration = 300;

// Team only (middleware). Refreshes followers and average views for everyone on the roster.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) {
    return NextResponse.json({ error: "Connect Airtable and Apify to pull creator stats." }, { status: 400 });
  }
  const { id } = await params;
  const roster = await getAssignments(id, { fresh: true });
  const creatorIds = roster.map((a) => a.creatorId).filter((x): x is string => Boolean(x));
  try {
    const result = await refreshCreatorStats(creatorIds);
    revalidateTag("airtable");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
