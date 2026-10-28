import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { importNewRequests } from "@/lib/requests";

export const maxDuration = 60;

// Team only (middleware). Called in the background when the Campaigns page opens: turns new request
// form submissions into Planning campaigns.
export async function POST() {
  try {
    const { created } = await importNewRequests();
    if (created.length) revalidateTag("airtable");
    return NextResponse.json({ ok: true, created });
  } catch (e) {
    console.error("Request import failed:", e);
    return NextResponse.json({ error: "Couldn't check for new requests." }, { status: 500 });
  }
}
