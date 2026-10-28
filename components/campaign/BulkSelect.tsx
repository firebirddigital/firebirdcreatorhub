"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";

/**
 * Team-only bulk selection on a campaign tab: checkboxes on cards plus a bar to act on the selection.
 * Used for deleting posts (Live) and removing creators from the campaign (Creators).
 */
const Ctx = createContext<{ selected: Set<string>; toggle: (id: string) => void; set: (ids: string[]) => void } | null>(null);

export function BulkSelectProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return <Ctx.Provider value={{ selected, toggle, set: (ids) => setSelected(new Set(ids)) }}>{children}</Ctx.Provider>;
}

/** A checkbox in the corner of a card. Renders nothing outside a provider (partner pages). */
export function SelectBox({ id, label }: { id: string; label: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  const on = ctx.selected.has(id);
  return (
    <label
      className={`absolute right-2 top-2 z-10 flex size-8 cursor-pointer items-center justify-center border-2 ${
        on ? "bg-fb-red border-fb-red" : "bg-fb-white/90 border-fb-black"
      }`}
      title={on ? "Selected" : "Select"}
    >
      <input type="checkbox" checked={on} onChange={() => ctx.toggle(id)} aria-label={`Select ${label}`} className="sr-only" />
      {on && (
        <span aria-hidden className="text-fb-white font-bold">
          ✓
        </span>
      )}
    </label>
  );
}

/** Select all / clear and the action button, shown above the cards. */
export function BulkBar({
  allIds,
  noun,
  action,
  confirmText,
  endpoint,
  bodyKey,
}: {
  allIds: string[];
  /** e.g. ["post", "posts"] */
  noun: [string, string];
  action: string;
  /** Confirmation, with {items} replaced by e.g. "3 posts". Plain text so server pages can pass it. */
  confirmText: string;
  endpoint: string;
  bodyKey: string;
}) {
  const ctx = useContext(Ctx);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  if (!ctx || !allIds.length) return null;
  const ids = allIds.filter((id) => ctx.selected.has(id));
  const word = ids.length === 1 ? noun[0] : noun[1];

  async function run() {
    if (!confirm(confirmText.replace("{items}", `${ids.length} ${word}`))) return;
    setBusy(true);
    setMessage(undefined);
    const res = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [bodyKey]: ids }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; removed?: number };
    setBusy(false);
    if (!res.ok) return setMessage({ text: data.error ?? "That didn't work. Try again.", error: true });
    setMessage({ text: `Done: ${data.removed ?? ids.length} ${(data.removed ?? ids.length) === 1 ? noun[0] : noun[1]}.` });
    ctx!.set([]);
    router.refresh();
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
      <button
        type="button"
        onClick={() => ctx.set(ids.length === allIds.length ? [] : allIds)}
        className="underline underline-offset-4 hover:text-fb-red"
      >
        {ids.length === allIds.length ? "Clear selection" : `Select all ${allIds.length}`}
      </button>
      {ids.length > 0 && (
        <>
          <span className="font-bold">
            {ids.length} {word} selected
          </span>
          <button
            type="button"
            onClick={run}
            disabled={busy}
            className="subtitle border-2 border-fb-black bg-fb-black text-fb-white px-4 py-2 text-xs hover:bg-fb-red hover:border-fb-red disabled:opacity-50"
          >
            {busy ? "Working…" : action}
          </button>
          {ids.length !== allIds.length && (
            <button type="button" onClick={() => ctx.set([])} className="underline underline-offset-4">
              Clear
            </button>
          )}
        </>
      )}
      {message && <span className={`font-bold ${message.error ? "text-fb-red" : ""}`}>{message.text}</span>}
    </div>
  );
}
