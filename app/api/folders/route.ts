import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCampaigns } from "@/lib/data";
import { cleanFolderName, createFolder } from "@/lib/folders";

// Team only (middleware). Make a new campaign folder, optionally with campaigns already in it.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; campaignIds?: unknown };
  const name = cleanFolderName(body.name);
  if (!name) return NextResponse.json({ error: "Give the folder a name." }, { status: 400 });
  const known = new Set((await getCampaigns()).map((c) => c.id));
  const campaignIds = (Array.isArray(body.campaignIds) ? body.campaignIds : []).filter(
    (c): c is string => typeof c === "string" && known.has(c),
  );
  const folder = await createFolder(name, campaignIds);
  revalidatePath("/campaigns", "layout");
  return NextResponse.json({ ok: true, folder });
}
