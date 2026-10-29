// Nightly creator stats: refreshes followers and average views (last 10 posts) for the creators whose
// stats are oldest, a few at a time, so the roster stays current on a rolling basis.
// Guard rails, because every creator costs Apify credit:
//   - skips the night when Apify spend is near the monthly limit (campaign post stats come first)
//   - only creators never updated or older than CREATOR_REFRESH_MIN_AGE_DAYS (default 14)
//   - at most CREATOR_REFRESH_PER_NIGHT creators (default 20, max 40)
// Server-side only.
import { getCreators } from "./data";
import { refreshCreatorStats } from "./roster";

const BATCH = 10;
/** Stop starting new batches after this long, so a run finishes well inside Vercel's 300s limit. */
const TIME_BUDGET_MS = 200_000;
/** Leave this share of the monthly Apify limit for the daily campaign post refresh. */
const SPEND_CEILING = 0.8;

const perNight = () => Math.min(40, Math.max(1, Number(process.env.CREATOR_REFRESH_PER_NIGHT) || 20));
const minAgeDays = () => Math.max(0, Number(process.env.CREATOR_REFRESH_MIN_AGE_DAYS ?? 14) || 0);

export interface CreatorRefreshResult {
  eligible: number;
  due: number;
  attempted: number;
  updated: number;
  batches: number;
  stoppedForTime: boolean;
  skipped?: string;
  apifySpend?: { used: number; limit: number };
  errors: string[];
}

/** This month's Apify spend against the plan's limit, when Apify reports it. */
async function apifySpend(): Promise<{ used: number; limit: number } | undefined> {
  try {
    const res = await fetch("https://api.apify.com/v2/users/me/limits", {
      headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
      cache: "no-store",
    });
    const d = ((await res.json()) as { data?: { limits?: { maxMonthlyUsageUsd?: number }; current?: { monthlyUsageUsd?: number } } }).data;
    const limit = d?.limits?.maxMonthlyUsageUsd;
    const used = d?.current?.monthlyUsageUsd;
    return typeof limit === "number" && typeof used === "number" ? { used, limit } : undefined;
  } catch {
    return undefined;
  }
}

const isBusy = (e: unknown) => /memory-limit|402/.test(String(e));

export async function refreshOldestCreators(limit = perNight()): Promise<CreatorRefreshResult> {
  const started = Date.now();
  const cutoff = Date.now() - minAgeDays() * 86_400_000;
  const creators = (await getCreators({ fresh: true })).filter((c) => c.tiktok || c.instagram);
  // Never-updated first, then the longest since their last update.
  const due = creators
    .filter((c) => !c.statsUpdated || new Date(c.statsUpdated).getTime() < cutoff)
    .sort((a, b) => (a.statsUpdated ?? "").localeCompare(b.statsUpdated ?? ""));

  const result: CreatorRefreshResult = {
    eligible: creators.length,
    due: due.length,
    attempted: 0,
    updated: 0,
    batches: 0,
    stoppedForTime: false,
    errors: [],
  };
  if (!due.length) return { ...result, skipped: "Everyone's stats are recent enough." };

  const spend = await apifySpend();
  result.apifySpend = spend;
  if (spend && spend.used >= spend.limit * SPEND_CEILING) {
    return {
      ...result,
      skipped: `Apify spend is $${spend.used.toFixed(2)} of $${spend.limit}; keeping the rest for campaign post stats.`,
    };
  }

  const queue = due.slice(0, limit).map((c) => c.id);
  for (let i = 0; i < queue.length; i += BATCH) {
    if (Date.now() - started > TIME_BUDGET_MS) {
      result.stoppedForTime = true;
      break;
    }
    const ids = queue.slice(i, i + BATCH);
    try {
      result.updated += (await refreshCreatorStats(ids)).updated;
    } catch (e) {
      if (isBusy(e) && Date.now() - started < TIME_BUDGET_MS - 60_000) {
        // Apify is at its memory limit (other runs going): wait once and retry this batch.
        await new Promise((r) => setTimeout(r, 30_000));
        try {
          result.updated += (await refreshCreatorStats(ids)).updated;
        } catch (e2) {
          result.errors.push(String(e2).slice(0, 200));
        }
      } else {
        // These creators stay oldest, so tomorrow's run picks them up first.
        result.errors.push(String(e).slice(0, 200));
      }
    }
    result.attempted += ids.length;
    result.batches++;
  }
  return result;
}
