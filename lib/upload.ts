// Chunked uploads to the hub's disk. Server-side only.
// The browser sends the video in pieces of a few megabytes (see components/DraftSourceInput.tsx), so a
// 500MB file never hits a proxy body-size limit or a request timeout. Pieces land in tmp/ and the
// finished file is moved under drafts/.
//   POST {action:"start", path, name, size, type}  → {uploadId}
//   PUT  ?uploadId=…&offset=…  (raw bytes)          → {received}
//   POST {action:"finish", uploadId}                → {url}
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { fileUrl } from "./files";
import { siteOrigin } from "./origin";
import { appendToFile, deleteFile, fileSize, isSafeKey, moveFile, readJson, writeJson } from "./storage";

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
/** Pieces bigger than this are refused; the client sends 8MB. */
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-m4v"]);
const EXTENSIONS: Record<string, string> = { mp4: "mp4", m4v: "m4v", mov: "mov", webm: "webm" };

interface PendingUpload {
  /** Final key without the extension, e.g. drafts/rec123/v1 */
  path: string;
  ext: string;
  size: number;
  startedAt: string;
}

const partKey = (id: string) => `tmp/${id}.part`;
const metaKey = (id: string) => `tmp/${id}.json`;
const validId = (id: string | null): id is string => Boolean(id && /^[a-f0-9]{32}$/.test(id));

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/**
 * Handles one upload request. `prefix` is the folder this caller may write into (e.g. "drafts/rec123/"),
 * checked against the path the browser asks for, so a creator can only fill their own folder.
 */
export async function handleUpload(req: Request, prefix: string): Promise<Response> {
  const url = new URL(req.url);

  if (req.method === "PUT") {
    const id = url.searchParams.get("uploadId");
    const offset = Number(url.searchParams.get("offset"));
    if (!validId(id) || !Number.isInteger(offset) || offset < 0) return bad("Bad upload request.");
    const meta = await readJson<PendingUpload>(metaKey(id));
    if (!meta || !meta.path.startsWith(prefix)) return bad("Upload not found. Start again.", 404);
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_CHUNK_BYTES) return bad("Bad upload piece.");
    const have = (await fileSize(partKey(id))) ?? 0;
    // The same piece sent twice (a retry) is fine; anything else means the pieces are out of order.
    if (offset + bytes.length <= have) return NextResponse.json({ received: have });
    if (offset !== have) return bad("Upload got out of step. Start again.", 409);
    if (have + bytes.length > meta.size || have + bytes.length > MAX_UPLOAD_BYTES) return bad("The file is bigger than it said it was.");
    await appendToFile(partKey(id), bytes);
    return NextResponse.json({ received: have + bytes.length });
  }

  if (req.method !== "POST") return bad("Method not allowed.", 405);
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    path?: string;
    name?: string;
    size?: number;
    type?: string;
    uploadId?: string;
  };

  if (body.action === "start") {
    const path = body.path ?? "";
    if (!path.startsWith(prefix) || !isSafeKey(path) || path.includes(".")) return bad("Bad upload path.");
    const size = Number(body.size);
    if (!Number.isInteger(size) || size <= 0) return bad("Choose a video file.");
    if (size > MAX_UPLOAD_BYTES) return bad(`That file is over ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`);
    const ext = EXTENSIONS[(body.name ?? "").split(".").pop()?.toLowerCase() ?? ""];
    if (!ext && !ALLOWED_TYPES.has(body.type ?? "")) return bad("Upload an MP4, MOV or WebM video.");
    const id = randomBytes(16).toString("hex");
    await writeJson(metaKey(id), { path, ext: ext ?? "mp4", size, startedAt: new Date().toISOString() } satisfies PendingUpload);
    return NextResponse.json({ uploadId: id });
  }

  if (body.action === "finish") {
    const id = body.uploadId ?? null;
    if (!validId(id)) return bad("Bad upload request.");
    const meta = await readJson<PendingUpload>(metaKey(id));
    if (!meta || !meta.path.startsWith(prefix)) return bad("Upload not found. Start again.", 404);
    const have = (await fileSize(partKey(id))) ?? 0;
    if (have !== meta.size) {
      await Promise.all([deleteFile(partKey(id)), deleteFile(metaKey(id))]);
      return bad("The upload didn't finish. Try again.");
    }
    // A random suffix so two uploads to the same path never clash and the address can't be guessed.
    const key = `${meta.path}-${randomBytes(6).toString("hex")}.${meta.ext}`;
    await moveFile(partKey(id), key);
    await deleteFile(metaKey(id));
    return NextResponse.json({ url: fileUrl(await siteOrigin(), key) });
  }

  return bad("Bad upload request.");
}
