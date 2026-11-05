"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Team only: show or hide current CPM (spend ÷ views so far) for this campaign, on every page that shows it. */
export function CurrentCpmSwitch({ campaignId, on, sample }: { campaignId: string; on: boolean; sample: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(on);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function change(next: boolean) {
    setChecked(next);
    setSaving(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaignId}/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showCurrentCpm: next }),
    }).catch(() => undefined);
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setSaving(false);
    if (!res?.ok) {
      setChecked(!next);
      setError(data?.error ?? "Couldn't save. Try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="switch">
        <input type="checkbox" checked={checked} disabled={sample || saving} onChange={(e) => change(e.target.checked)} />
        <span className="track" aria-hidden />
        <span className="font-bold">Show current CPM</span>
      </label>
      <span className="text-xs text-muted">
        {saving
          ? "Saving…"
          : checked
            ? "Shown here, on the partner link and in the wrap report."
            : "Hidden everywhere, including the partner link and wrap report. Expected CPM still shows."}
      </span>
      {error && <span className="text-xs font-bold text-fb-red">{error}</span>}
    </div>
  );
}
