import Link from "next/link";
import { Header } from "@/components/Header";
import { NewCampaign } from "@/components/campaign/CampaignEditor";
import { StatusTag } from "@/components/StatusTag";
import { isSampleMode } from "@/lib/config";
import { getCampaignSummaries } from "@/lib/data";
import { compact, dateRange, pct } from "@/lib/format";

export const revalidate = 300;

export default async function CampaignsPage() {
  const summaries = await getCampaignSummaries();

  return (
    <>
      <Header active="campaigns" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="headline text-7xl max-sm:text-5xl">Campaigns</h1>
          <NewCampaign sample={isSampleMode()} />
        </div>

        {summaries.length === 0 ? (
          <p className="mt-10 max-w-prose">
            No campaigns yet. Click New campaign to set up the first one.
          </p>
        ) : (
          <ul className="mt-12 border-t-2 border-fb-black">
            {summaries.map(({ campaign, totals, posts, engagementRate }) => (
              <li key={campaign.id} className="border-b border-fb-black/20">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="group grid grid-cols-[1fr_auto] md:grid-cols-[1.4fr_0.8fr_0.5fr_0.5fr] items-center gap-x-8 gap-y-2 py-7"
                >
                  <div>
                    <p className="text-sm">{campaign.artist}</p>
                    <h2 className="subtitle text-2xl mt-1 group-hover:text-fb-red transition-colors">{campaign.name}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <StatusTag status={campaign.status} />
                      <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
                    </div>
                  </div>
                  <div className="text-right md:text-left">
                    <p className="figure text-5xl max-sm:text-4xl text-fb-red">{posts ? compact(totals.views) : "—"}</p>
                    <p className="text-sm mt-1">views</p>
                  </div>
                  <div className="max-md:hidden">
                    <p className="figure text-2xl">{posts}</p>
                    <p className="text-sm mt-1">posts live</p>
                  </div>
                  <div className="max-md:hidden">
                    <p className="figure text-2xl">{posts ? pct(engagementRate) : "—"}</p>
                    <p className="text-sm mt-1">engagement</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
