import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isSampleMode } from "@/lib/config";
import { getAssignment } from "@/lib/data";
import { addCreatorsToCampaign, updateAssignment } from "@/lib/roster";
import type { AssignmentStatus } from "@/lib/types";

const sampleBlock = () => NextResponse.json({ error: "Connect Airtable to change the roster." }, { status: 400 });

// Team only (middleware). Add creators to a campaign's roster.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return sampleBlock();
  const { id } = await params;
  const { creatorIds } = (await req.json().catch(() => ({}))) as { creatorIds?: string[] };
  if (!creatorIds?.length) return NextResponse.json({ error: "Pick at least one creator." }, { status: 400 });
  const added = await addCreatorsToCampaign(id, creatorIds);
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, added });
}

const STATUSES: AssignmentStatus[] = ["Proposed", "Approved", "Changes requested", "Declined"];

// Change a roster entry's status or fee.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isSampleMode()) return sampleBlock();
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { assignmentId?: string; status?: string; fee?: number | null };
  const assignment = body.assignmentId ? await getAssignment(body.assignmentId) : undefined;
  if (!assignment || assignment.campaignId !== id) {
    return NextResponse.json({ error: "That creator isn't on this campaign." }, { status: 404 });
  }
  const status = STATUSES.find((s) => s === body.status);
  const fee = body.fee === null ? null : typeof body.fee === "number" && body.fee >= 0 ? body.fee : undefined;
  await updateAssignment(assignment.id, { status, fee });
  revalidateTag("airtable");
  return NextResponse.json({ ok: true });
}
