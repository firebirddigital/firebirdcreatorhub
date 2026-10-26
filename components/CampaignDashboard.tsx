import { compact, full, money, pct } from "@/lib/format";
import { PLATFORM_LABEL } from "@/lib/social";
import type { CampaignView } from "@/lib/types";
import { HeroFigure, HeroStats } from "./campaign/Shell";
import { PostGrid } from "./PostGrid";
import { ViewsChart } from "./ViewsChart";

/** Headline figure for the Live stage. Cost per view only appears for the team. */
export function LiveHero({ view, internal }: { view: CampaignView; internal: boolean }) {
  const { campaign, totals } = view;
  const cpm = internal && campaign.budget && totals.views ? (campaign.budget / totals.views) * 1000 : undefined;
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
          internal
            ? { label: "Cost per 1K views", value: cpm !== undefined ? money(cpm, 2) : "—", note: "Team only" }
            : { label: "Avg views per post", value: totals.posts ? compact(totals.views / totals.posts) : "—" },
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
}: {
  view: CampaignView;
  internal: boolean;
  sample: boolean;
  tools?: React.ReactNode;
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
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-8">Creators appear here once their posts are added.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="headline text-3xl">The posts</h2>
        <div className="mt-8">
          <PostGrid posts={posts} sample={sample} internal={internal} />
        </div>
      </section>
    </>
  );
}
