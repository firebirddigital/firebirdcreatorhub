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
  const select = "border-2 border-fb-black bg-fb-white px-3 py-2 text-sm min-w-[200px] max-sm:w-full";
  const portfolio = partners.filter((p) => p.portfolio);
  const others = partners.filter((p) => !p.portfolio);

  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="block max-sm:w-full">
        <span className="subtitle block text-xs mb-1">Period</span>
        <select className={select} value={period} onChange={(e) => go({ period: e.target.value as Period })}>
          {PERIODS.map(([p, label]) => (
            <option key={p} value={p}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block max-sm:w-full">
        <span className="subtitle block text-xs mb-1">Partner</span>
        <select className={select} value={partner ?? ""} onChange={(e) => go({ partner: e.target.value || undefined })}>
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
      <label className="block max-sm:w-full">
        <span className="subtitle block text-xs mb-1">Artist</span>
        <select className={select} value={artist ?? ""} onChange={(e) => go({ artist: e.target.value || undefined })}>
          <option value="">All artists</option>
          {artists.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      {(artist || partner || period !== "all") && (
        <Link href="/analytics" className="pb-2 text-sm font-bold underline underline-offset-4 hover:text-fb-red">
          Clear filters
        </Link>
      )}
    </div>
  );
}
