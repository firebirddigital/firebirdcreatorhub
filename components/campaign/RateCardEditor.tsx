"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { money } from "@/lib/format";
import { RATE_TYPES, type RateCard, type RateType } from "@/lib/types";

const toText = (rates?: RateCard) =>
  Object.fromEntries(RATE_TYPES.map((t) => [t, rates?.[t] != null ? String(rates[t]) : ""])) as Record<RateType, string>;

/** The fields for a rate card, for forms that save it themselves (e.g. adding a creator). */
export function RateCardFields({
  value,
  onChange,
}: {
  value: Record<RateType, string>;
  onChange: (next: Record<RateType, string>) => void;
}) {
  return (
    <div className="grid grid-cols-2 items-end gap-x-3 gap-y-2">
      {RATE_TYPES.map((t) => (
        <label key={t} className="block text-xs">
          <span className="field-label">{t}</span>
          <span className="relative block">
            <span aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
              $
            </span>
            <input
              inputMode="decimal"
              value={value[t]}
              onChange={(e) => onChange({ ...value, [t]: e.target.value.replace(/[^\d.]/g, "") })}
              placeholder="—"
              className="field pl-6 tabular-nums"
            />
          </span>
        </label>
      ))}
    </div>
  );
}

export const emptyRateText = () => toText();

/** Text inputs → a rate card with only the filled-in amounts. */
export function rateCardFromText(text: Record<RateType, string>): RateCard {
  const out: RateCard = {};
  for (const t of RATE_TYPES) {
    const n = Number(text[t]);
    if (text[t].trim() && isFinite(n) && n >= 0) out[t] = n;
  }
  return out;
}

/**
 * Rates per deliverable type (Reel, TikTok, Shorts…) for one creator on one campaign. Read-only without
 * `editable`; hidden then if nothing is set.
 */
export function RateCardEditor({
  campaignId,
  assignmentId,
  rates,
  editable,
}: {
  campaignId: string;
  assignmentId: string;
  rates?: RateCard;
  editable?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => toText(rates));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = RATE_TYPES.filter((t) => rates?.[t] != null);

  if (!editable && !set.length) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaignId}/roster`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentId, rates: rateCardFromText(text) }),
    });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't save. Try again.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (open) {
    return (
      <form onSubmit={save} className="space-y-3 rounded-card border border-line bg-wash-neutral p-3">
        <p className="field-label mb-1">Rates by deliverable</p>
        <RateCardFields value={text} onChange={setText} />
        {error && <p className="text-sm font-bold text-fb-red">{error}</p>}
        <div className="flex items-center gap-2">
          <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
            {busy ? "Saving…" : "Save rates"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setText(toText(rates));
              setError(undefined);
            }}
            className="btn btn-quiet btn-sm"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-secondary">Rates by deliverable</p>
        {editable && (
          <button
            type="button"
            onClick={() => {
              setText(toText(rates));
              setOpen(true);
            }}
            className="underline underline-offset-4 hover:text-fb-red"
          >
            {set.length ? "Edit rates" : "Add rates"}
          </button>
        )}
      </div>
      {set.length > 0 ? (
        <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
          {set.map((t) => (
            <div key={t} className="contents">
              <dt className="text-secondary">{t}</dt>
              <dd className="text-right font-bold tabular-nums">{money(rates![t]!, rates![t]! % 1 ? 2 : 0)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-muted">None set yet.</p>
      )}
    </div>
  );
}
