import Link from "next/link";
import type { Period } from "@/lib/partners";

const PERIODS: [Period, string][] = [
  ["all", "All time"],
  ["year", "This year"],
  ["90d", "Last 90 days"],
];

/** Period pills; a campaign counts in a period by its start date. */
export function PartnerPeriod({ period, base, extra = "" }: { period: Period; base: string; extra?: string }) {
  return (
    <nav aria-label="Period" className="flex flex-wrap gap-2">
      {PERIODS.map(([p, label]) => (
        <Link
          key={p}
          href={`${base}?period=${p}${extra}`}
          aria-current={p === period ? "page" : undefined}
          className={`subtitle px-4 py-2 text-xs border-2 ${
            p === period ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-black hover:bg-fb-black hover:text-fb-white"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export const parsePeriod = (v?: string): Period => (v === "year" || v === "90d" ? v : "all");
