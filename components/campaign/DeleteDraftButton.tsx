"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Team only: deletes one draft version after a confirm. */
export function DeleteDraftButton({ campaignId, draftId, label }: { campaignId: string; draftId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function remove() {
    if (
      !confirm(
        `Delete ${label}? It disappears for the team and partners. A video uploaded to the hub is deleted for good; a linked video stays where it is.`,
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaignId}/drafts?draft=${encodeURIComponent(draftId)}`, { method: "DELETE" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; fileNote?: string };
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "That didn't delete. Try again.");
    if (data.fileNote) alert(data.fileNote);
    router.refresh();
  }

  return (
    <span className="text-xs">
      <button type="button" onClick={remove} disabled={busy} className="underline underline-offset-2 hover:text-fb-red disabled:opacity-50">
        {busy ? "Deleting…" : "Delete draft"}
      </button>
      {error && <span className="ml-2 font-bold text-fb-red">{error}</span>}
    </span>
  );
}
