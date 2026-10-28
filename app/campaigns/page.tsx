import Link from "next/link";
import { Suspense } from "react";
import { CampaignFilters } from "@/components/CampaignFilters";
import { RequestImport } from "@/components/RequestImport";
import { Header } from "@/components/Header";
import { RequestsInbox } from "@/components/RequestsInbox";
import { ManualCampaign } from "@/components/campaign/CampaignEditor";
import { StatusTag } from "@/components/StatusTag";
import { isSampleMode, REQUEST_FORM_URL } from "@/lib/config";
import { getAnalytics, normalize } from "@/lib/analytics";
import { getCampaignSummaries } from "@/lib/data";
import { getRequests, requestsDirect } from "@/lib/requests";
import { compact, dateRange, pct } from "@/lib/format";
import { campaignType, type CampaignType } from "@/lib/types";

export const revalidate = 300;

const TABS: { key: string; type: CampaignType; label: string }[] = [
  { key: "influencer", type: "Influencer", label: "Influencer Campaigns" },
  {
    key: "seeding",
    type: "Content Seeding",
    label: "Content Seeding Campaigns",
  },
];

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; partner?: string }>;
}) {
  const [all, sp, inbox, analytics] = await Promise.all([
    getCampaignSummaries(),
    searchParams,
    getRequests(),
    getAnalytics(),
  ]);
  const tab = TABS.find((t) => t.key === sp.type) ?? TABS[0];

  // Partners per campaign, through the campaign's artist (IP DB Roster).
  const partnersOf = new Map(
    analytics.campaigns.map((c) => [c.id, c.partners]),
  );
  const words = (sp.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const partnerKey = sp.partner ? normalize(sp.partner) : "";
  const matches = all.filter(({ campaign }) => {
    const text =
      `${campaign.name} ${campaign.artist} ${campaign.song ?? ""}`.toLowerCase();
    if (!words.every((w) => text.includes(w))) return false;
    return (
      !partnerKey ||
      (partnersOf.get(campaign.id) ?? []).some(
        (p) => normalize(p) === partnerKey,
      )
    );
  });
  const filtering = words.length > 0 || Boolean(partnerKey);
  const summaries = matches.filter(
    (s) => campaignType(s.campaign) === tab.type,
  );
  const count = (type: CampaignType) =>
    matches.filter((s) => campaignType(s.campaign) === type).length;
  const typeFieldMissing =
    !isSampleMode() && all.length > 0 && all.every((s) => !s.campaign.type);

  return (
    <>
      <Header active="campaigns" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-6">
          <h1 className="headline text-7xl max-sm:text-5xl mr-3">Campaigns</h1>
          <a
            href={REQUEST_FORM_URL}
            target="_blank"
            rel="noreferrer"
            title="The Airtable form partners fill in. Opens in a new tab; copy the link to send it."
            className="ml-auto subtitle bg-fb-red text-fb-white px-6 py-3.5 text-sm hover:bg-fb-black transition-colors"
          >
            Request a campaign
          </a>
        </div>

        {requestsDirect() && !isSampleMode() && <RequestImport />}
        <RequestsInbox
          requests={inbox.requests}
          missingTables={inbox.missingTables}
          sample={isSampleMode()}
          campaigns={all.map(({ campaign }) => ({
            id: campaign.id,
            name: campaign.name,
            artist: campaign.artist,
          }))}
        />

        <Suspense>
          <CampaignFilters partners={analytics.options.partners} />
        </Suspense>

        <nav
          aria-label="Campaign type"
          className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-b-2 border-fb-black"
        >
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/campaigns?${new URLSearchParams({ type: t.key, ...(sp.q ? { q: sp.q } : {}), ...(sp.partner ? { partner: sp.partner } : {}) })}`}
              aria-current={t.key === tab.key ? "page" : undefined}
              className={`subtitle -mb-0.5 pb-3 text-lg border-b-4 transition-colors ${
                t.key === tab.key
                  ? "border-fb-red"
                  : "border-transparent hover:border-fb-black"
              }`}
            >
              {t.label}{" "}
              <span className="font-sans font-normal text-base">
                {count(t.type)}
              </span>
            </Link>
          ))}
        </nav>
        {typeFieldMissing && (
          <p className="mt-4 max-w-prose text-sm">
            Sorted by name for now: anything with “seeding” in the name or song
            counts as Content Seeding. Add a single select field called{" "}
            <span className="font-bold">Type</span> (Influencer, Content
            Seeding) to the Campaigns table in Airtable to set it per campaign
            from Edit campaign.
          </p>
        )}

        {summaries.length === 0 ? (
          <p className="mt-10 max-w-prose">
            {filtering
              ? `No ${tab.label.toLowerCase()} match.`
              : all.length
                ? `No ${tab.label.toLowerCase()} yet. New ones appear here when the request form is submitted.`
                : "No campaigns yet. New ones appear here when the request form is submitted."}
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
                    <p className="text-sm">
                      {campaign.artist}
                      {(partnersOf.get(campaign.id) ?? []).length > 0 && (
                        <span>
                          {" "}
                          · {partnersOf.get(campaign.id)!.join(", ")}
                        </span>
                      )}
                    </p>
                    <h2 className="subtitle text-2xl mt-1 group-hover:text-fb-red transition-colors">
                      {campaign.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <StatusTag status={campaign.status} />
                      <span>
                        {dateRange(campaign.startDate, campaign.endDate)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right md:text-left">
                    <p className="figure text-5xl max-sm:text-4xl text-fb-red">
                      {posts ? compact(totals.views) : "—"}
                    </p>
                    <p className="text-sm mt-1">views</p>
                  </div>
                  <div className="max-md:hidden">
                    <p className="figure text-2xl">{posts}</p>
                    <p className="text-sm mt-1">posts live</p>
                  </div>
                  <div className="max-md:hidden">
                    <p className="figure text-2xl">
                      {posts ? pct(engagementRate) : "—"}
                    </p>
                    <p className="text-sm mt-1">engagement</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <section aria-label="Manual upload" className="mt-16">
          <ManualCampaign key={tab.key} sample={isSampleMode()} type={tab.type} />
        </section>
      </main>
    </>
  );
}
