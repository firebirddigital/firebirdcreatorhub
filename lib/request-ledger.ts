// When the hub reads request forms straight from the operations base (read-only key), it can't write
// "Accepted" back there, so it keeps its own record of each request here, on the hub's disk.
// Server-side only.
import { readJson, writeJson } from "./storage";

const PATH = "requests/ledger.json";

export interface RequestLedger {
  /** When auto-import was switched on. Requests submitted before this aren't turned into campaigns. */
  startedAt: string;
  lastImportAt?: string;
  entries: Record<string, { status: "Accepted" | "Dismissed" | "New"; campaignIds: string[]; auto?: boolean }>;
}

export async function readLedger(): Promise<RequestLedger> {
  const saved = await readJson<RequestLedger>(PATH);
  if (saved) return saved;
  // First run: start the clock now and save it, so the cut-off never moves.
  // To keep an earlier cut-off (say, after moving hosts), set REQUEST_LEDGER_STARTED_AT to that date.
  const startedAt = process.env.REQUEST_LEDGER_STARTED_AT || new Date().toISOString();
  const fresh: RequestLedger = { startedAt: new Date(startedAt).toISOString(), entries: {} };
  await writeLedger(fresh);
  return fresh;
}

export const writeLedger = (ledger: RequestLedger) => writeJson(PATH, ledger);

/** Read, change and save in one go (re-reading first so a change made elsewhere isn't lost). */
export async function updateLedger(change: (l: RequestLedger) => void): Promise<RequestLedger> {
  const ledger = await readLedger();
  change(ledger);
  await writeLedger(ledger);
  return ledger;
}
