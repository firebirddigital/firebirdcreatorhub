"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Team only: one of a campaign's display switches (lib/campaign-settings.ts), saved as soon as it's flipped. */
export function CampaignSwitch({
  campaignId,
  setting,
  label,
  on,
  onNote,
  offNote,
  sample,
}: {
  campaignId: string;
  setting: "showCurrentCpm" | "showEngagementToPartners";
  label: string;
  on: boolean;
  onNote: string;
  offNote: string;
  sample: boolean;
}) {
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
      body: JSON.stringify({ [setting]: next }),
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <label className="switch">
        <input type="checkbox" checked={checked} disabled={sample || saving} onChange={(e) => change(e.target.checked)} />
        <span className="track" aria-hidden />
        <span className="font-bold">{label}</span>
      </label>
      <span className="text-xs text-muted">
        {saving ? "Saving…" : checked ? onNote : offNote}
      </span>
      {error && <span className="text-xs font-bold text-fb-red">{error}</span>}
    </div>
  );
}
