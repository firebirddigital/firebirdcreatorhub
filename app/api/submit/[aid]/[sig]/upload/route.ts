import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { privateBlobToken } from "@/lib/blob";
import { isValidSubmit } from "@/lib/auth";

// Issues a short-lived token so the creator's browser can upload the video straight to
// Vercel Blob (no size limit from our server). Only valid, signed upload links get a token.
export async function POST(req: Request, { params }: { params: Promise<{ aid: string; sig: string }> }) {
  const { aid, sig } = await params;
  if (!(await isValidSubmit(aid, sig))) return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });
  if (!privateBlobToken()) {
    return NextResponse.json({ error: "Uploads aren't set up yet. Ask the Firebird team." }, { status: 503 });
  }

  const body = (await req.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request: req,
      // Drafts go to the private store; pages sign short-lived links to play them.
      token: privateBlobToken(),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`drafts/${aid}/`)) throw new Error("Bad upload path");
        return {
          allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"],
          maximumSizeInBytes: 500 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      // The draft record is created by the page after upload, so nothing to do here.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
