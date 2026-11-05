"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Campaign Brief": opens the linked Google Doc in a new tab. With no link yet it opens nothing and says
 * so underneath. On the team dashboard (`campaignId` set) the link can be added or changed here too.
 */
export function CampaignBriefButton({ url, campaignId }: { url?: string; campaignId?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briefUrl: value.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; skipped?: string[] };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "That didn't save. Try again.");
      return;
    }
    if (data.skipped?.includes("Brief Link")) {
      setError("Add a URL field called “Brief Link” to the Campaigns table in Airtable, then save again.");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://docs.google.com/document/d/…"
          aria-label="Campaign brief link"
          className="field min-w-72 flex-1"
        />
        <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
          {busy ? "Saving…" : value.trim() ? "Save link" : "Remove link"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setValue(url ?? "");
            setError(undefined);
          }}
          className="btn btn-quiet btn-sm"
        >
          Cancel
        </button>
        {error && <p className="basis-full text-sm font-bold text-fb-red">{error}</p>}
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-3">
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="btn">
            Campaign Brief <span aria-hidden>↗</span>
          </a>
        ) : (
          <button type="button" aria-disabled="true" className="btn cursor-default opacity-60" onClick={(e) => e.preventDefault()}>
            Campaign Brief
          </button>
        )}
        {campaignId && (
          <button type="button" onClick={() => setEditing(true)} className="text-sm underline underline-offset-4 hover:text-fb-red">
            {url ? "Change link" : "Add brief link"}
          </button>
        )}
      </div>
      {!url && <p className="text-xs text-muted">No brief available.</p>}
    </div>
  );
}
