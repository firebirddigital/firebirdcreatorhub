import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { privateBlobToken } from "@/lib/blob";

// Team only (middleware). Issues a short-lived token so a team member's browser can upload a
// draft straight to Vercel Blob. No upload-completed callback: it would be blocked by the login gate,
// and the draft record is created by the form after the upload finishes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!privateBlobToken()) {
    return NextResponse.json({ error: "File uploads aren't set up. Paste a link instead." }, { status: 503 });
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      // Drafts go to the private store; pages sign short-lived links to play them.
      token: privateBlobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`drafts/team/${id}/`)) throw new Error("Bad upload path");
        return {
          allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
