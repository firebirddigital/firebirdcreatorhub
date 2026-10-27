import { compact, cpmVsExpected, full, money, pct, times, typicalVsUsual } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/social";
import type { CampaignStreams } from "@/lib/streams";
import { streamsLift } from "@/lib/streams-lift";
import type { CampaignView } from "@/lib/types";
import { HeroFigure, HeroStats, type HeroStat } from "./campaign/Shell";
import { PostGrid } from "./PostGrid";
import { StreamsChart } from "./StreamsChart";
import { ViewsChart } from "./ViewsChart";

/**
 * Headline figure for the Live stage. Cost per 1K views uses approved fees when entered, otherwise
 * the budget; partners only see it when the campaign shows rates (the share page strips spend otherwise).
 */
export function LiveHero({ view, internal }: { view: CampaignView; internal: boolean }) {
  const { totals, spend } = view;
  const cpm = spend && totals.views ? (spend.amount / totals.views) * 1000 : undefined;
  const vsUsual = typicalVsUsual(view.posts);
  // Current against expected CPM. The team sees green (cheaper) or red (dearer); partner pages keep to
  // brand colours: red when dearer, white with ↓ when cheaper.
  const vs = cpmVsExpected(cpm, view.expected?.cpm);
  const tone = vs ? (vs.under ? (internal ? "good" : "under") : "bad") : undefined;
  return (
    <>
      <HeroFigure
        value={compact(totals.views)}
        title={`${full(totals.views)} views`}
        caption={
          <>
            views across {totals.posts} {totals.posts === 1 ? "post" : "posts"} from {totals.creators}{" "}
            {totals.creators === 1 ? "creator" : "creators"}
          </>
        }
      />
      <HeroStats
        items={[
          { label: "Likes", value: compact(totals.likes) },
          { label: "Comments", value: compact(totals.comments) },
          { label: "Shares", value: compact(totals.shares) },
          { label: "Engagement rate", value: pct(totals.engagementRate) },
          ...(vsUsual
            ? [{ label: "Typical post vs usual", value: vsUsual, note: "Middle post against its creator's last-20-post average" }]
            : []),
          internal || spend
            ? {
                label: "Current CPM",
                value: cpm !== undefined ? money(cpm, 2) : "—",
                note: [spend ? (spend.basis === "fees" ? "From approved fees" : "From the budget") : "Add fees or a budget", internal ? "Team only" : ""]
                  .filter(Boolean)
                  .join(". "),
                tone,
                sub: vs?.text,
              } as HeroStat
            : { label: "Avg views per post", value: totals.posts ? compact(totals.views / totals.posts) : "—" },
          ...(internal || view.expected
            ? [
              {
                label: "Expected CPM",
                value: view.expected?.cpm !== undefined ? money(view.expected.cpm, 2) : "—",
                note:
                  view.expected?.cpm === undefined
                    ? "Needs fees or rates, and avg views"
                    : view.expected.counted < view.expected.total
                      ? `From ${view.expected.counted} of ${view.expected.total} approved creators`
                      : "Cost per post ÷ avg views × 1,000",
              },
              ]
            : []),
        ]}
      />
    </>
  );
}

/** Chart, top creators and the post grid for the Live stage. */
export function LiveBody({
  view,
  internal,
  sample,
  tools,
  streams,
  streamsControls,
}: {
  view: CampaignView;
  internal: boolean;
  sample: boolean;
  tools?: React.ReactNode;
  /** Daily Spotify streams, when uploaded (and, for partners, shared). */
  streams?: CampaignStreams;
  /** Team-only upload and sharing controls. */
  streamsControls?: React.ReactNode;
}) {
  const { series, topCreators, posts } = view;
  return (
    <>
      {tools}

      <section className="grid gap-14 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <h2 className="headline text-3xl">Views over time</h2>
          <div className="mt-8">
            <ViewsChart series={series} />
          </div>
        </div>
        <div>
          <h2 className="headline text-3xl">Top creators</h2>
          {topCreators.length ? (
            <ol className="mt-8 border-t-2 border-fb-black">
              {topCreators.slice(0, 6).map((c, i) => (
                <li key={c.creatorId ?? i} className="flex items-center gap-4 border-b border-fb-black/20 py-3.5">
                  <span className="figure w-6 text-lg text-fb-red">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{c.creator?.name ?? "Unassigned"}</p>
                    <p className="text-sm">
                      {c.platforms.map((p) => PLATFORM_LABEL[p]).join(" and ")}, {c.posts}{" "}
                      {c.posts === 1 ? "post" : "posts"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="figure text-lg">{compact(c.views)}</p>
                    <p className="text-xs">{pct(c.engagementRate)} eng.</p>
                    {c.benchmark && (
                      <p className="text-xs" title="Views on this campaign against their usual (last 20 posts) average">
                        {times(c.benchmark.views, c.benchmark.expected)} usual
                      </p>
                    )}
                    {c.fee && c.views ? (
                      <p className="text-xs" title={internal ? "Fee ÷ views × 1,000. Team only." : "Fee ÷ views × 1,000"}>
                        {money((c.fee / c.views) * 1000, 2)}/1K
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-8">Creators appear here once their posts are added.</p>
          )}
        </div>
      </section>

      {(streams || streamsControls) && (
        <section>
          <h2 className="headline text-3xl">Spotify streams</h2>
          {streams && (
            <div className="mt-8">
              <StreamsChart
                days={streams.days}
                song={streams.song}
                startDate={view.campaign.startDate}
                lift={streamsLift(streams.days, view.campaign.startDate)}
              />
            </div>
          )}
          {streamsControls}
        </section>
      )}

      <section>
        <h2 className="headline text-3xl">The posts</h2>
        <div className="mt-8">
          <PostGrid posts={posts} sample={sample} internal={internal} />
        </div>
      </section>
    </>
  );
}
