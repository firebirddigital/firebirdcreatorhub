import { NextResponse } from "next/server";
import { isValidSubmit } from "@/lib/auth";
import { handleUpload } from "@/lib/upload";

// Takes a creator's draft video in pieces and stores it on the hub's disk under drafts/<assignment>/.
// Only valid, signed upload links can upload, and only into their own folder.
async function handle(req: Request, { params }: { params: Promise<{ aid: string; sig: string }> }) {
  const { aid, sig } = await params;
  if (!(await isValidSubmit(aid, sig))) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  return handleUpload(req, `drafts/${aid}/`);
}

export const POST = handle;
export const PUT = handle;
