import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { isValidFileLink } from "@/lib/auth";
import { contentTypeFor, fileSize, isSafeKey, openFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Serves a stored draft video. Open to anyone with a valid, unexpired signed link (pages sign them
// with lib/files.ts), so partner share pages and creator pages can play drafts without a team login.
// Supports range requests so scrubbing works in the browser's player.
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.map(decodeURIComponent).join("/");
  const url = new URL(req.url);
  if (!isSafeKey(key) || !key.startsWith("drafts/")) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await isValidFileLink(key, url.searchParams.get("exp"), url.searchParams.get("sig")))) {
    return NextResponse.json({ error: "This link has expired. Reload the page." }, { status: 403 });
  }
  const size = await fileSize(key);
  if (size === undefined) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": contentTypeFor(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${key.split("/").pop()}"`,
  };

  const range = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
    headers["Content-Length"] = String(end - start + 1);
    return new Response(Readable.toWeb(openFile(key, { start, end })) as ReadableStream, { status: 206, headers });
  }

  headers["Content-Length"] = String(size);
  if (req.method === "HEAD") return new Response(null, { status: 200, headers });
  return new Response(Readable.toWeb(openFile(key)) as ReadableStream, { status: 200, headers });
}

export const HEAD = GET;
