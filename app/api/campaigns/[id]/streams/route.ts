import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/data";
import { mergeStreams, removeStreams, setStreamsSharing } from "@/lib/streams";

const MAX_DAYS = 3000;

// Team only (middleware). Saves daily streams parsed from a Spotify for Artists CSV.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getCampaign(id))) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { days?: unknown; song?: unknown };
  const days = (Array.isArray(body.days) ? body.days : [])
    .map((d) => d as { date?: unknown; streams?: unknown })
    .filter((d): d is { date: string; streams: number } =>
      typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && typeof d.streams === "number" && isFinite(d.streams) && d.streams >= 0,
    )
    .slice(0, MAX_DAYS);
  if (!days.length) return NextResponse.json({ error: "No days with streams in that file." }, { status: 400 });
  try {
    const saved = await mergeStreams(id, days, typeof body.song === "string" ? body.song.slice(0, 120) : undefined);
    return NextResponse.json({ ok: true, days: saved.days.length, from: saved.days[0]?.date, to: saved.days.at(-1)?.date });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// Switch whether partners see the streams on the share link and wrap report.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { shareWithPartner } = (await req.json().catch(() => ({}))) as { shareWithPartner?: unknown };
  if (typeof shareWithPartner !== "boolean") return NextResponse.json({ error: "Say whether to share." }, { status: 400 });
  try {
    await setStreamsSharing(id, shareWithPartner);
    return NextResponse.json({ ok: true, shareWithPartner });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

// Remove the saved streams so a corrected file can be uploaded fresh.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await removeStreams(id);
  return NextResponse.json({ ok: true });
}
