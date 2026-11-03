"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { analyticsHref, type Period } from "@/lib/analytics-href";

const PERIODS: [Period, string][] = [
  ["all", "All time"],
  ["year", "This year"],
  ["90d", "Last 90 days"],
];

export function AnalyticsFilters({
  period,
  artist,
  partner,
  artists,
  partners,
}: {
  period: Period;
  artist?: string;
  partner?: string;
  artists: string[];
  partners: { name: string; portfolio: boolean }[];
}) {
  const router = useRouter();
  const go = (change: { period?: Period; artist?: string; partner?: string }) =>
    router.push(analyticsHref({ period, artist, partner, ...change }));
  const portfolio = partners.filter((p) => p.portfolio);
  const others = partners.filter((p) => !p.portfolio);

  // Sits inside the page's sticky `.filters` bar, which supplies the rule and spacing.
  return (
    <div className="filter-row m-0 border-b-0 pb-0">
      <div className="flex flex-col gap-1 max-sm:w-full">
        <span className="field-label mb-0" id="analytics-period">
          Period
        </span>
        <div className="seg" role="group" aria-labelledby="analytics-period">
          {PERIODS.map(([p, label]) => (
            <button key={p} type="button" aria-pressed={period === p} onClick={() => go({ period: p })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <label>
        Partner
        <select className="min-w-[200px] max-sm:min-w-0" value={partner ?? ""} onChange={(e) => go({ partner: e.target.value || undefined })}>
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
      <label>
        Artist
        <select className="min-w-[200px] max-sm:min-w-0" value={artist ?? ""} onChange={(e) => go({ artist: e.target.value || undefined })}>
          <option value="">All artists</option>
          {artists.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      {(artist || partner || period !== "all") && (
        <Link href="/analytics" className="btn btn-quiet btn-sm">
          Clear filters
        </Link>
      )}
    </div>
  );
}
