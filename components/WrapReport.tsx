import { compact, cpmVsExpected, dateRange, full, money, pct, shortDate, times, typicalVsUsual } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/social";
import type { CampaignStreams } from "@/lib/streams";
import { streamsLift } from "@/lib/streams-lift";
import type { CampaignView } from "@/lib/types";
import { Logo } from "./Logo";
import { PrintButton } from "./PrintButton";
import { StreamsChart } from "./StreamsChart";
import { ViewsChart } from "./ViewsChart";

/**
 * One-page campaign wrap, built to be saved as a PDF from the browser and forwarded to artists,
 * managers and labels. Brand: red headlines in caps, black caps subtitles, Lato body, red/black/white only,
 * logo top-left with 57px clear space. Money only appears when `view.spend` is set (team, or partners
 * when the campaign shows rates).
 */
export function WrapReport({
  view,
  audience,
  streams,
}: {
  view: CampaignView;
  audience: "team" | "partner";
  /** Pass only what this audience may see: partners get streams only when the team shared them. */
  streams?: CampaignStreams;
}) {
  const { campaign, totals, spend } = view;
  const cpm = spend && totals.views ? (spend.amount / totals.views) * 1000 : undefined;
  const vsUsual = typicalVsUsual(view.posts);
  const topPosts = [...view.posts].sort((a, b) => b.views - a.views).slice(0, 6);
  const generated = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  // Current against expected CPM: the team version uses the kit's "good" series colour/red; the partner version stays on-brand
  // (red when dearer, black with ↓ when cheaper).
  const vs = cpmVsExpected(cpm, view.expected?.cpm);
  const vsClass = vs ? (vs.under ? (audience === "team" ? "text-[color:var(--series-4)]" : "") : "text-fb-red") : "";
  const stats: { label: string; value: string; note?: string; className?: string; sub?: string }[] = [
    { label: "Posts", value: String(totals.posts) },
    { label: "Creators", value: String(totals.creators) },
    { label: "Engagement rate", value: pct(totals.engagementRate) },
    { label: "Likes", value: compact(totals.likes) },
    { label: "Comments", value: compact(totals.comments) },
    { label: "Shares", value: compact(totals.shares) },
    ...(vsUsual ? [{ label: "Typical post vs usual", value: vsUsual, note: "Middle post against its creator's last-10-post median" }] : []),
    ...(cpm !== undefined
      ? [
          {
            label: "Current CPM",
            value: `${vs?.under && audience !== "team" ? "↓ " : ""}${money(cpm, 2)}`,
            note: spend?.basis === "fees" ? "From approved creator fees" : "From the campaign budget",
            className: vsClass,
            sub: vs?.text,
          },
        ]
      : []),
    ...(view.expected?.cpm !== undefined
      ? [
          {
            label: "Expected CPM",
            value: money(view.expected.cpm, 2),
            note: "Fees or rates ÷ creators' median views × 1,000, before the campaign",
          },
        ]
      : []),
  ];

  return (
    <div className="wrap-report mx-auto max-w-[1000px] print:max-w-none">
      <div className="flex items-center justify-between gap-6 print:hidden">
        <p className="text-sm text-secondary">
          {audience === "team"
            ? "Team version: includes cost figures. Partners get their own version from the share link."
            : "Save this page as a PDF to share it."}
        </p>
        <PrintButton />
      </div>

      <header className="mt-8 print:mt-0">
        {/* Logo top-left with clear space, per brand guidelines */}
        <div className="pb-12 max-sm:pb-8 print:pb-10">
          <Logo />
        </div>
        <p className="subtitle text-[13px] tracking-[0.06em] text-muted">
          {campaign.artist}
          {campaign.song ? `, “${campaign.song}”` : ""}
        </p>
        <h1 className="headline mt-2 text-5xl max-sm:text-4xl">Campaign wrap</h1>
        <p className="mt-3 text-[15px] text-secondary">
          {campaign.name}
          {dateRange(campaign.startDate, campaign.endDate) ? ` · ${dateRange(campaign.startDate, campaign.endDate)}` : ""}
        </p>
      </header>

      <section className="card hero mt-8 break-inside-avoid">
        <p className="tile-label">Total views</p>
        <p className="tile-value text-[72px] leading-none max-sm:text-5xl" title={`${full(totals.views)} views`}>
          {compact(totals.views)}
        </p>
        <dl className="mt-6 grid grid-cols-4 max-sm:grid-cols-2 gap-x-6 gap-y-5 border-t border-line pt-5">
          {stats.map((s) => (
            <div key={s.label} className="min-w-0">
              <dt className="tile-label">{s.label}</dt>
              <dd className={`tile-value text-[24px] ${s.className || "text-fb-black"}`}>{s.value}</dd>
              {s.sub && <p className={`mt-1 text-xs font-bold ${s.className ?? ""}`}>{s.sub}</p>}
              {s.note && <p className="mt-1 text-xs text-muted">{s.note}</p>}
            </div>
          ))}
        </dl>
      </section>

      <section className="card mt-3.5 break-inside-avoid">
        <h2>Views over time</h2>
        <div className="mt-4">
          <ViewsChart series={view.series} />
        </div>
      </section>

      {streams && streams.days.length > 1 && (
        <section className="card mt-3.5 break-inside-avoid">
          <h2>Spotify streams</h2>
          <div className="mt-4">
            <StreamsChart
              days={streams.days}
              song={streams.song}
              startDate={campaign.startDate}
              lift={streamsLift(streams.days, campaign.startDate)}
            />
          </div>
        </section>
      )}

      {topPosts.length > 0 && (
        <section className="card mt-3.5 break-inside-avoid">
          <h2>Top posts</h2>
          <div className="table-wrap mt-3">
            <table>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th>Platform</th>
                  <th>Posted</th>
                  <th className="num">Views</th>
                  <th className="num">Engagement</th>
                  <th className="num">Vs their usual</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href={p.url} className="font-bold underline underline-offset-2 hover:text-fb-red">
                        {p.creator?.name ?? "Creator"}
                      </a>
                    </td>
                    <td>{PLATFORM_LABEL[p.platform]}</td>
                    <td>{shortDate(p.postedAt)}</td>
                    <td className="num font-bold text-fb-red">{compact(p.views)}</td>
                    <td className="num">{p.views ? pct((p.likes + p.comments + p.shares) / p.views) : "—"}</td>
                    <td className="num">{p.creator?.avgViews ? times(p.views, p.creator.avgViews) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view.topCreators.length > 0 && (
        <section className="card mt-3.5 break-inside-avoid">
          <h2>Creators</h2>
          <div className="table-wrap mt-3">
            <table>
              <thead>
                <tr>
                  <th>Creator</th>
                  <th className="num">Posts</th>
                  <th className="num">Views</th>
                  <th className="num">Engagement</th>
                  <th className="num">Vs usual</th>
                  {spend && <th className="num">Cost per 1K</th>}
                </tr>
              </thead>
              <tbody>
                {view.topCreators.map((c, i) => (
                  <tr key={c.creatorId ?? i}>
                    <td className="font-bold">{c.creator?.name ?? "Unassigned"}</td>
                    <td className="num">{c.posts}</td>
                    <td className="num font-bold">{compact(c.views)}</td>
                    <td className="num">{pct(c.engagementRate)}</td>
                    <td className="num">{c.benchmark ? times(c.benchmark.views, c.benchmark.expected) : "—"}</td>
                    {spend && <td className="num">{c.fee && c.views ? money((c.fee / c.views) * 1000, 2) : "—"}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer className="mt-8 border-t border-line pt-4 text-xs text-muted flex justify-between gap-4 max-sm:flex-col">
        <span className="shrink-0">Prepared by Firebird · {generated}</span>
        <span className="sm:text-right">
          Views from public post data. “Vs usual” compares each post with the creator&apos;s average across their last 10 posts.
        </span>
      </footer>
    </div>
  );
}
