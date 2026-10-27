// Browser helper: pulls creator stats in batches of 10 so big selections don't hit the time limit.

export async function pullStatsInBatches(
  ids: string[],
  onProgress: (done: number) => void,
): Promise<{ requested: number; updated: number }> {
  let requested = 0;
  let updated = 0;
  for (let i = 0; i < ids.length; i += 10) {
    const res = await fetch("/api/creators/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: ids.slice(i, i + 10) }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; requested?: number; updated?: number };
    if (!res.ok) throw new Error(`${data.error ?? "Pulling stats failed."}${updated ? ` Stats were updated for ${updated} before it stopped.` : ""}`);
    requested += data.requested ?? 0;
    updated += data.updated ?? 0;
    onProgress(Math.min(ids.length, i + 10));
  }
  return { requested, updated };
}
