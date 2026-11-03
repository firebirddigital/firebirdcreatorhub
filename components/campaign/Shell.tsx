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

/** Campaign header with the three-step navigation. The stage-specific headline figure goes in `hero`. */
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
      <header className="pt-1">
        <p className="subtitle text-[11px] tracking-[0.08em] text-muted">
          {campaign.artist}
          {campaign.song ? `, “${campaign.song}”` : ""}
        </p>
        <h1 className="headline mt-2 text-4xl max-sm:text-3xl max-w-5xl">{campaign.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          <StatusTag status={campaign.status} />
          <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
        </div>
      </header>

      <div className="mt-5">{hero}</div>

      {/* The campaign is a sequence: numbered phase cards, each saying what to do there. */}
      <nav aria-label="Campaign phases" className="grid cards-3 mt-3.5">
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
              className={`card group flex flex-col no-underline transition-colors ${active ? "hero" : "hover:bg-wash-neutral"}`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className={`tile-label mb-0 ${active ? "text-fb-red" : ""}`}>Phase {i + 1}</span>
                <span
                  className={`pill ${
                    isCurrent ? "border-fb-red bg-fb-red text-white" : done ? "text-secondary" : "text-muted"
                  }`}
                >
                  {done && <span aria-hidden>✓ </span>}
                  {status}
                </span>
              </span>
              <span className="mt-3 font-display text-[15px] font-bold uppercase tracking-[0.04em]">{s.label}</span>
              <span className="mt-1 text-sm text-secondary">{s.action}</span>
              <span
                className={`mt-3 text-xs font-bold ${
                  active ? "text-fb-red" : "text-muted group-hover:text-fb-red group-hover:underline underline-offset-4"
                }`}
              >
                {active ? "You're viewing this phase" : `Open phase ${i + 1} →`}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-3.5 flex flex-col gap-3.5 [&>*]:min-w-0">{children}</div>
    </>
  );
}

export function HeroFigure({ value, caption, title }: { value: string; caption: React.ReactNode; title?: string }) {
  return (
    <div className="card hero rise flex flex-wrap items-end gap-x-6 gap-y-2">
      <p className="tile-value" title={title}>
        {value}
      </p>
      <p className="pb-1 max-w-72 text-sm leading-snug text-secondary">{caption}</p>
    </div>
  );
}

export interface HeroStat {
  label: string;
  value: string;
  note?: string;
  /** Colours the value: "good" green and "bad" red for the team; partner pages use "bad" or "under" (ink, ↓) to stay on-brand. */
  tone?: "good" | "bad" | "under";
  /** A short line under the value, e.g. "18% under expected". */
  sub?: string;
}

const HERO_TONE: Record<NonNullable<HeroStat["tone"]>, string> = {
  good: "text-[color:var(--series-4)]",
  bad: "text-fb-red",
  under: "",
};

export function HeroStats({ items }: { items: HeroStat[] }) {
  return (
    <dl className={`grid ${items.length === 3 ? "cards-3" : "cards"} mt-3.5`}>
      {items.map((it) => (
        <div key={it.label} className="card">
          <dt className="tile-label">{it.label}</dt>
          <dd className={`tile-value ${it.tone ? HERO_TONE[it.tone] : ""}`}>
            {it.tone === "under" && <span aria-hidden>↓ </span>}
            {it.value}
          </dd>
          {it.sub && <p className={`mt-1.5 text-xs font-bold ${it.tone ? HERO_TONE[it.tone] : ""}`}>{it.sub}</p>}
          {it.note && <p className="delta-note mt-1.5 leading-snug">{it.note}</p>}
        </div>
      ))}
    </dl>
  );
}
