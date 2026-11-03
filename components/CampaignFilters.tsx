"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** Search box and partner filter for the campaigns list. Both live in the address, so a filtered view can be shared. */
export function CampaignFilters({ partners }: { partners: { name: string; portfolio: boolean }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const partner = params.get("partner") ?? "";

  const go = (change: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(change)) v ? next.set(k, v) : next.delete(k);
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => go({ q: q.trim() }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const portfolio = partners.filter((p) => p.portfolio);
  const others = partners.filter((p) => !p.portfolio);
  return (
    <div className="filter-row">
      <label className="grow max-w-md">
        Search
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Campaign, artist or song"
          className="w-full"
        />
      </label>
      <label>
        Partner
        <select className="min-w-[220px] max-sm:min-w-0" value={partner} onChange={(e) => go({ partner: e.target.value })}>
          <option value="">All partners</option>
          {portfolio.length > 0 && (
            <optgroup label="Portfolio companies">
              {portfolio.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Other partners">
              {others.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {(q || partner) && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            go({ q: "", partner: "" });
          }}
          className="btn btn-quiet btn-sm"
        >
          Clear
        </button>
      )}
    </div>
  );
}
