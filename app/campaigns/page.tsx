import Link from "next/link";
import { Header } from "@/components/Header";
import { NewCampaign } from "@/components/campaign/CampaignEditor";
import { StatusTag } from "@/components/StatusTag";
import { isSampleMode } from "@/lib/config";
import { getCampaignSummaries } from "@/lib/data";
import { compact, dateRange, pct } from "@/lib/format";
import { campaignType, type CampaignType } from "@/lib/types";

export const revalidate = 300;

const TABS: { key: string; type: CampaignType; label: string }[] = [
  { key: "influencer", type: "Influencer", label: "Influencer Campaigns" },
  { key: "seeding", type: "Content Seeding", label: "Content Seeding Campaigns" },
];

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const [all, sp] = await Promise.all([getCampaignSummaries(), searchParams]);
  const tab = TABS.find((t) => t.key === sp.type) ?? TABS[0];
  const summaries = all.filter((s) => campaignType(s.campaign) === tab.type);
  const count = (type: CampaignType) => all.filter((s) => campaignType(s.campaign) === type).length;
  const typeFieldMissing = !isSampleMode() && all.length > 0 && all.every((s) => !s.campaign.type);

  return (
    <>
      <Header active="campaigns" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="headline text-7xl max-sm:text-5xl">Campaigns</h1>
          <NewCampaign key={tab.key} sample={isSampleMode()} type={tab.type} />
        </div>

        <nav aria-label="Campaign type" className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-b-2 border-fb-black">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/campaigns?type=${t.key}`}
              aria-current={t.key === tab.key ? "page" : undefined}
              className={`subtitle -mb-0.5 pb-3 text-lg border-b-4 transition-colors ${
                t.key === tab.key ? "border-fb-red" : "border-transparent hover:border-fb-black"
              }`}
            >
              {t.label} <span className="font-sans font-normal text-base">{count(t.type)}</span>
            </Link>
          ))}
        </nav>
        {typeFieldMissing && (
          <p className="mt-4 max-w-prose text-sm">
            Sorted by name for now: anything with “seeding” in the name or song counts as Content Seeding. Add a single
            select field called <span className="font-bold">Type</span> (Influencer, Content Seeding) to the Campaigns
            table in Airtable to set it per campaign from Edit campaign.
          </p>
        )}

        {summaries.length === 0 ? (
          <p className="mt-10 max-w-prose">
            {all.length
              ? `No ${tab.label.toLowerCase()} yet. Click New campaign to set one up.`
              : "No campaigns yet. Click New campaign to set up the first one."}
          </p>
        ) : (
          <ul>
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
