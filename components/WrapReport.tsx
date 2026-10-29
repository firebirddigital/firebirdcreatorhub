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

  // Current against expected CPM: the team version uses green/red; the partner version stays on-brand
  // (red when dearer, black with ↓ when cheaper).
  const vs = cpmVsExpected(cpm, view.expected?.cpm);
  const vsClass = vs ? (vs.under ? (audience === "team" ? "text-green-700" : "") : "text-fb-red") : "";
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
    <div className="wrap-report mx-auto max-w-[1000px] bg-fb-white px-[57px] py-[57px] max-sm:px-6 max-sm:py-8 print:max-w-none print:p-0">
      <div className="flex items-start justify-between gap-6 print:hidden">
        <p className="text-sm">
          {audience === "team"
            ? "Team version: includes cost figures. Partners get their own version from the share link."
            : "Save this page as a PDF to share it."}
        </p>
        <PrintButton />
      </div>

      <header className="mt-10 print:mt-0">
        {/* Logo top-left with 57px clear space, per brand guidelines */}
        <div className="pb-[57px]">
          <Logo />
        </div>
        <p className="subtitle text-lg">
          {campaign.artist}
          {campaign.song ? `, “${campaign.song}”` : ""}
        </p>
        <h1 className="headline mt-2 text-6xl max-sm:text-4xl">Campaign wrap</h1>
        <p className="mt-3 text-lg">
          {campaign.name}
          {dateRange(campaign.startDate, campaign.endDate) ? ` · ${dateRange(campaign.startDate, campaign.endDate)}` : ""}
        </p>
      </header>

      <section className="mt-12 break-inside-avoid">
        <p className="figure text-[120px] leading-none text-fb-red max-sm:text-7xl" title={`${full(totals.views)} views`}>
          {compact(totals.views)}
        </p>
        <p className="subtitle mt-2 text-xl">Total views</p>
        <dl className="mt-8 grid grid-cols-4 max-sm:grid-cols-2 border-t-2 border-fb-black">
          {stats.map((s) => (
            <div key={s.label} className="border-b border-fb-black py-4 pr-4">
              <dt className="text-sm">{s.label}</dt>
              <dd className={`figure mt-1 text-3xl ${s.className ?? ""}`}>{s.value}</dd>
              {s.sub && <p className={`mt-1 text-xs font-bold ${s.className ?? ""}`}>{s.sub}</p>}
              {s.note && <p className="mt-1 text-xs">{s.note}</p>}
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-14 break-inside-avoid">
        <h2 className="headline text-3xl">Views over time</h2>
        <div className="mt-6">
          <ViewsChart series={view.series} />
        </div>
      </section>

      {streams && streams.days.length > 1 && (
        <section className="mt-14 break-inside-avoid">
          <h2 className="headline text-3xl">Spotify streams</h2>
          <div className="mt-6">
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
        <section className="mt-14 break-inside-avoid">
          <h2 className="headline text-3xl">Top posts</h2>
          <table className="mt-6 w-full text-sm border-t-2 border-fb-black">
            <thead>
              <tr className="border-b-2 border-fb-black text-left">
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4">Platform</th>
                <th className="py-2 pr-4">Posted</th>
                <th className="py-2 pr-4 text-right">Views</th>
                <th className="py-2 pr-4 text-right">Engagement</th>
                <th className="py-2 text-right">Vs their usual</th>
              </tr>
            </thead>
            <tbody>
              {topPosts.map((p) => (
                <tr key={p.id} className="border-b border-fb-black">
                  <td className="py-2 pr-4">
                    <a href={p.url} className="font-bold underline underline-offset-2">
                      {p.creator?.name ?? "Creator"}
                    </a>
                  </td>
                  <td className="py-2 pr-4">{PLATFORM_LABEL[p.platform]}</td>
                  <td className="py-2 pr-4">{shortDate(p.postedAt)}</td>
                  <td className="py-2 pr-4 text-right figure text-base text-fb-red">{compact(p.views)}</td>
                  <td className="py-2 pr-4 text-right">{p.views ? pct((p.likes + p.comments + p.shares) / p.views) : "—"}</td>
                  <td className="py-2 text-right">{p.creator?.avgViews ? times(p.views, p.creator.avgViews) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {view.topCreators.length > 0 && (
        <section className="mt-14 break-inside-avoid">
          <h2 className="headline text-3xl">Creators</h2>
          <table className="mt-6 w-full text-sm border-t-2 border-fb-black">
            <thead>
              <tr className="border-b-2 border-fb-black text-left">
                <th className="py-2 pr-4">Creator</th>
                <th className="py-2 pr-4 text-right">Posts</th>
                <th className="py-2 pr-4 text-right">Views</th>
                <th className="py-2 pr-4 text-right">Engagement</th>
                <th className="py-2 pr-4 text-right">Vs usual</th>
                {spend && <th className="py-2 text-right">Cost per 1K</th>}
              </tr>
            </thead>
            <tbody>
              {view.topCreators.map((c, i) => (
                <tr key={c.creatorId ?? i} className="border-b border-fb-black">
                  <td className="py-2 pr-4 font-bold">{c.creator?.name ?? "Unassigned"}</td>
                  <td className="py-2 pr-4 text-right">{c.posts}</td>
                  <td className="py-2 pr-4 text-right figure text-base">{compact(c.views)}</td>
                  <td className="py-2 pr-4 text-right">{pct(c.engagementRate)}</td>
                  <td className="py-2 pr-4 text-right">{c.benchmark ? times(c.benchmark.views, c.benchmark.expected) : "—"}</td>
                  {spend && <td className="py-2 text-right">{c.fee && c.views ? money((c.fee / c.views) * 1000, 2) : "—"}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-16 border-t-2 border-fb-black pt-4 text-xs flex justify-between gap-4">
        <span>Prepared by Firebird · {generated}</span>
        <span>
          Views from public post data. “Vs usual” compares each post with the creator&apos;s average across their last 10 posts.
        </span>
      </footer>
    </div>
  );
}
