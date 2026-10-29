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
  const field = "border-2 border-fb-black bg-fb-white px-3 py-2 text-sm max-sm:w-full";

  return (
    <div className="mt-8 flex flex-wrap items-end gap-4">
      <label className="block grow max-w-md max-sm:w-full">
        <span className="subtitle block text-xs mb-1">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Campaign, artist or song"
          className={`${field} w-full`}
        />
      </label>
      <label className="block max-sm:w-full">
        <span className="subtitle block text-xs mb-1">Partner</span>
        <select className={`${field} min-w-[220px]`} value={partner} onChange={(e) => go({ partner: e.target.value })}>
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
          className="pb-2 text-sm font-bold underline underline-offset-4 hover:text-fb-red"
        >
          Clear
        </button>
      )}
    </div>
  );
}
