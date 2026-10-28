// When the hub reads request forms straight from the operations base (read-only key), it can't write
// "Accepted" back there, so it keeps its own record of each request here, in the private Blob store.
// Server-side only.
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { privateBlobToken } from "./blob";

const PATH = "requests/ledger.json";

export interface RequestLedger {
  /** When auto-import was switched on. Requests submitted before this aren't turned into campaigns. */
  startedAt: string;
  lastImportAt?: string;
  entries: Record<string, { status: "Accepted" | "Dismissed" | "New"; campaignIds: string[]; auto?: boolean }>;
}

export async function readLedger(): Promise<RequestLedger> {
  const token = privateBlobToken();
  if (!token) throw new Error("Private storage isn't set up.");
  try {
    const res = await get(PATH, { access: "private", token, useCache: false });
    if (res && res.statusCode === 200) return JSON.parse(await new Response(res.stream).text()) as RequestLedger;
  } catch (e) {
    if (!(e instanceof BlobNotFoundError)) throw e;
  }
  // First run: start the clock now and save it, so the cut-off never moves.
  const fresh: RequestLedger = { startedAt: new Date().toISOString(), entries: {} };
  await writeLedger(fresh);
  return fresh;
}

export async function writeLedger(ledger: RequestLedger) {
  await put(PATH, JSON.stringify(ledger), {
    access: "private",
    token: privateBlobToken(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

/** Read, change and save in one go (re-reading first so a change made elsewhere isn't lost). */
export async function updateLedger(change: (l: RequestLedger) => void): Promise<RequestLedger> {
  const ledger = await readLedger();
  change(ledger);
  await writeLedger(ledger);
  return ledger;
}
