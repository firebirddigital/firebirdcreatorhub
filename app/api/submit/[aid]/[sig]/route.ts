import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isValidSubmit } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { getAssignment } from "@/lib/data";
import { createDraft } from "@/lib/roster";

// Saves an uploaded draft against the creator's roster entry.
export async function POST(req: Request, { params }: { params: Promise<{ aid: string; sig: string }> }) {
  const { aid, sig } = await params;
  if (!(await isValidSubmit(aid, sig))) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (isSampleMode()) return NextResponse.json({ error: "Uploads are off in sample mode." }, { status: 400 });

  const assignment = await getAssignment(aid);
  if (!assignment || assignment.status === "Declined") {
    return NextResponse.json({ error: "This upload link is no longer active." }, { status: 403 });
  }

  const { videoUrl, caption } = (await req.json().catch(() => ({}))) as { videoUrl?: string; caption?: string };
  // Only accept files that landed in our Blob store under this creator's folder
  let ok = false;
  try {
    const u = new URL(videoUrl ?? "");
    ok = u.hostname.endsWith(".blob.vercel-storage.com") && u.pathname.startsWith(`/drafts/${aid}/`);
  } catch {}
  if (!ok) return NextResponse.json({ error: "Upload the video first." }, { status: 400 });

  const version = await createDraft(assignment, videoUrl!, caption);
  revalidateTag("airtable");
  return NextResponse.json({ ok: true, version });
}
