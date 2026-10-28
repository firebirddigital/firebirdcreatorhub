import Link from "next/link";
import { dateRange } from "@/lib/format";
import type { Campaign, Stage } from "@/lib/types";
import { StatusTag } from "../StatusTag";

export const STAGES: { key: Stage; label: string; action: string }[] = [
  { key: "creators", label: "Creators", action: "Approve the creator lineup" },
  { key: "drafts", label: "Drafts", action: "Watch and approve each video" },
  { key: "live", label: "Live", action: "Track views and results" },
];

export function parseTab(v?: string | string[]): Stage | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return STAGES.find((x) => x.key === s)?.key;
}

/** Black campaign header with the three-step navigation. The stage-specific headline figure goes in `hero`. */
export function CampaignShell({
  campaign,
  tab,
  current,
  basePath,
  hero,
  children,
}: {
  campaign: Campaign;
  tab: Stage;
  current: Stage;
  basePath: string;
  hero: React.ReactNode;
  children: React.ReactNode;
}) {
  const currentIndex = STAGES.findIndex((s) => s.key === current);

  return (
    <>
      <section className="bg-fb-black text-fb-white px-[57px] max-sm:px-6 pt-14 pb-0">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <StatusTag status={campaign.status} inverse />
          <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
        </div>
        <p className="subtitle mt-6 text-lg">
          {campaign.artist}
          {campaign.song ? `, “${campaign.song}”` : ""}
        </p>
        <h1 className="headline mt-2 text-6xl max-sm:text-4xl max-w-5xl">{campaign.name}</h1>

        <div className="mt-12">{hero}</div>

        {/* The campaign is a sequence: numbered phase cards, each saying what to do there. */}
        <nav aria-label="Campaign phases" className="mt-14 pb-10 grid gap-3 sm:grid-cols-3">
          {STAGES.map((s, i) => {
            const active = s.key === tab;
            const done = i < currentIndex;
            const isCurrent = s.key === current;
            const status = isCurrent ? "Now" : done ? "Done" : "Up next";
            return (
              <Link
                key={s.key}
                href={`${basePath}?tab=${s.key}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={`group relative flex flex-col border-2 p-5 max-sm:p-4 transition-colors ${
                  active
                    ? "bg-fb-white text-fb-black border-fb-white"
                    : "border-fb-white/40 hover:border-fb-white hover:bg-fb-white/10"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className={`subtitle text-xs ${active ? "text-fb-red" : "text-fb-white/75"}`}>Phase {i + 1}</span>
                  <span
                    className={`px-2 py-0.5 text-xs font-bold ${
                      isCurrent
                        ? "bg-fb-red text-fb-white"
                        : done
                          ? active
                            ? "border border-fb-black"
                            : "border border-fb-white/60"
                          : active
                            ? "border border-fb-black/40"
                            : "border border-fb-white/30 text-fb-white/75"
                    }`}
                  >
                    {done && <span aria-hidden>✓ </span>}
                    {status}
                  </span>
                </span>
                <span className="subtitle mt-3 text-2xl max-sm:text-xl">{s.label}</span>
                <span className={`mt-1 text-sm ${active ? "" : "text-fb-white/75"}`}>{s.action}</span>
                <span className={`mt-4 text-sm font-bold ${active ? "text-fb-red" : "group-hover:underline underline-offset-4"}`}>
                  {active ? "You're viewing this phase" : `Open phase ${i + 1} →`}
                </span>
              </Link>
            );
          })}
        </nav>
      </section>
      <div className="px-[57px] max-sm:px-6 py-14 space-y-16">{children}</div>
    </>
  );
}

export function HeroFigure({ value, caption, title }: { value: string; caption: React.ReactNode; title?: string }) {
  return (
    <div className="rise flex flex-wrap items-end gap-x-10 gap-y-4">
      <p className="figure text-fb-red text-[clamp(5rem,16vw,13rem)]" title={title}>
        {value}
      </p>
      <p className="pb-4 max-w-64 text-lg leading-snug">{caption}</p>
    </div>
  );
}

export interface HeroStat {
  label: string;
  value: string;
  note?: string;
  /** Colours the value: "good" green and "bad" red for the team; partner pages use "bad" or "under" (white, ↓) to stay on-brand. */
  tone?: "good" | "bad" | "under";
  /** A short line under the value, e.g. "18% under expected". */
  sub?: string;
}

const HERO_TONE: Record<NonNullable<HeroStat["tone"]>, string> = {
  good: "text-green-400",
  bad: "text-fb-red",
  under: "",
};

export function HeroStats({ items }: { items: HeroStat[] }) {
  return (
    <dl className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-fb-white/40">
      {items.map((it) => (
        <div key={it.label} className="pt-5 pr-4 pb-2">
          <dt className="text-sm">
            {it.label}
            {it.note && <span className="ml-2 text-xs text-fb-red">{it.note}</span>}
          </dt>
          <dd className={`figure mt-2 text-3xl ${it.tone ? HERO_TONE[it.tone] : ""}`}>
            {it.tone === "under" && <span aria-hidden>↓ </span>}
            {it.value}
          </dd>
          {it.sub && <p className={`mt-1 text-xs font-bold ${it.tone ? HERO_TONE[it.tone] : ""}`}>{it.sub}</p>}
        </div>
      ))}
    </dl>
  );
}
