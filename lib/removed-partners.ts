// Partners the team has removed from Analytics (for example, internal or test entries in the roster).
// Stored as one small JSON file in the private Blob store, so a removal can be undone. Server-side only.
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { privateBlobToken } from "./blob";

const PATH = "analytics/removed-partners.json";

// Without private storage (sample mode, local runs), removals last until the server restarts.
let memory: string[] = [];

export async function getRemovedPartners(): Promise<string[]> {
  const token = privateBlobToken();
  if (!token) return memory;
  try {
    const res = await get(PATH, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200) return [];
    const data = JSON.parse(await new Response(res.stream).text()) as { names?: unknown };
    return Array.isArray(data.names) ? data.names.filter((n): n is string => typeof n === "string") : [];
  } catch (e) {
    if (e instanceof BlobNotFoundError) return [];
    throw e;
  }
}

export async function setPartnerRemoved(name: string, removed: boolean): Promise<string[]> {
  const current = await getRemovedPartners();
  const others = current.filter((n) => n.toLowerCase() !== name.toLowerCase());
  const names = (removed ? [...others, name] : others).sort((a, b) => a.localeCompare(b));
  const token = privateBlobToken();
  if (!token) return (memory = names);
  await put(PATH, JSON.stringify({ names, updatedAt: new Date().toISOString() }), {
    access: "private",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return names;
}
