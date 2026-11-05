import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { cleanArtistName, setManualArtist } from "@/lib/artists";

async function change(req: Request, present: boolean) {
  const { name } = (await req.json().catch(() => ({}))) as { name?: unknown };
  const clean = cleanArtistName(name);
  if (!clean) return NextResponse.json({ error: "Type the artist's name." }, { status: 400 });
  const names = await setManualArtist(clean, present);
  revalidatePath("/campaigns");
  return NextResponse.json({ ok: true, name: clean, names });
}

// Team only (middleware). Add an artist to the campaigns list's Artist filter before they have a campaign.
export const POST = (req: Request) => change(req, true);
// Remove a hand-added artist (artists with campaigns stay, since they come from the campaigns).
export const DELETE = (req: Request) => change(req, false);
