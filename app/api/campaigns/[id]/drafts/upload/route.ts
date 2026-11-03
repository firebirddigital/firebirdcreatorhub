import { handleUpload } from "@/lib/upload";

// Team only (middleware). Takes a team member's draft video in pieces and stores it on the hub's disk
// under drafts/team/<campaign>/. The draft record is created by the form after the upload finishes.
async function handle(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleUpload(req, `drafts/team/${id}/`);
}

export const POST = handle;
export const PUT = handle;
