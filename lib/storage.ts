// File storage on the server's own disk (a Render persistent disk in production). Server-side only.
// Everything the hub keeps outside Airtable lives under DATA_DIR: draft videos, each campaign's
// Spotify streams, the removed-partners list, the request ledger and the encrypted Gmail connection.
//   DATA_DIR   Folder to store files in. On Render this is the disk's mount path, e.g. /var/data.
//              Locally it defaults to ./.data (ignored by git).
import { createReadStream, type ReadStream } from "node:fs";
import { appendFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

export const dataDir = () => process.env.DATA_DIR || path.join(process.cwd(), ".data");

/** A storage key is a relative path like "drafts/rec123/v1-abc.mp4". Only plain characters, no "..". */
export function isSafeKey(key: string): boolean {
  if (!key || key.length > 300) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)) return false;
  return !key.split("/").some((part) => part === "" || part === "." || part === "..");
}

function fullPath(key: string): string {
  if (!isSafeKey(key)) throw new Error(`Bad storage key: ${key}`);
  return path.join(dataDir(), key);
}

async function ensureParent(file: string) {
  await mkdir(path.dirname(file), { recursive: true });
}

const notFound = (e: unknown) => (e as NodeJS.ErrnoException)?.code === "ENOENT";

export async function readJson<T>(key: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(fullPath(key), "utf8")) as T;
  } catch (e) {
    if (notFound(e)) return undefined;
    throw e;
  }
}

/** Writes to a temp file first and renames, so a crash mid-write never leaves a half-written file. */
export async function writeJson(key: string, value: unknown) {
  const file = fullPath(key);
  await ensureParent(file);
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(value), "utf8");
  await rename(tmp, file);
}

export async function deleteFile(key: string) {
  await rm(fullPath(key), { force: true });
}

export async function fileSize(key: string): Promise<number | undefined> {
  try {
    const s = await stat(fullPath(key));
    return s.isFile() ? s.size : undefined;
  } catch (e) {
    if (notFound(e)) return undefined;
    throw e;
  }
}

export function openFile(key: string, range?: { start: number; end: number }): ReadStream {
  return createReadStream(fullPath(key), range);
}

/** Adds bytes to the end of a file, creating it (and its folders) on first write. */
export async function appendToFile(key: string, bytes: Uint8Array) {
  const file = fullPath(key);
  await ensureParent(file);
  await appendFile(file, bytes);
}

/** Moves a finished upload from the temp area to its final key. */
export async function moveFile(fromKey: string, toKey: string) {
  const to = fullPath(toKey);
  await ensureParent(to);
  await rename(fullPath(fromKey), to);
}

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  json: "application/json",
};

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}
