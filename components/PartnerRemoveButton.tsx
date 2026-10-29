"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Removes a partner from Analytics, or restores one. Removal asks first; both can be undone. */
export function PartnerRemoveButton({ name, restore = false, leaveFilter }: { name: string; restore?: boolean; leaveFilter?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function go() {
    if (!restore && !confirm(`Remove ${name} from Analytics? Its campaigns stay, they just won't count toward ${name}. You can restore it later.`)) return;
    setBusy(true);
    const res = await fetch("/api/partners/removed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, removed: !restore }),
    });
    setBusy(false);
    if (!res.ok) {
      alert(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't work. Try again.");
      return;
    }
    if (leaveFilter) router.push(leaveFilter);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      aria-label={`${restore ? "Restore" : "Remove"} ${name}`}
      className="text-xs underline underline-offset-4 hover:text-fb-red disabled:opacity-50"
    >
      {busy ? "Saving…" : restore ? "Restore" : "Remove"}
    </button>
  );
}
