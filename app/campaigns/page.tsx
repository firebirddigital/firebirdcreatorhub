import Link from "next/link";
import { Suspense } from "react";
import { CampaignFilters } from "@/components/CampaignFilters";
import { RequestImport } from "@/components/RequestImport";
import { TeamShell } from "@/components/Header";
import { PageHead, SegLinks } from "@/components/nest/Rail";
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
    <TeamShell active="campaigns">
      <PageHead title="Campaigns">
        <a
          href={REQUEST_FORM_URL}
          target="_blank"
          rel="noreferrer"
          title="The Airtable form partners fill in. Opens in a new tab; copy the link to send it."
          className="btn btn-primary"
        >
          Request a campaign
        </a>
      </PageHead>

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

      <div className="filters page-filters">
        <SegLinks
          label="Campaign type"
          options={TABS.map((t) => ({
            href: `/campaigns?${new URLSearchParams({ type: t.key, ...(sp.q ? { q: sp.q } : {}), ...(sp.partner ? { partner: sp.partner } : {}) })}`,
            label: t.label,
            active: t.key === tab.key,
            count: count(t.type),
          }))}
        />
      </div>

      <section className="card">
        <Suspense>
          <CampaignFilters partners={analytics.options.partners} />
        </Suspense>
        {typeFieldMissing && (
          <p className="banner max-w-prose">
            Sorted by name for now: anything with “seeding” in the name or song
            counts as Content Seeding. Add a single select field called{" "}
            <strong>Type</strong> (Influencer, Content Seeding) to the Campaigns
            table in Airtable to set it per campaign from Edit campaign.
          </p>
        )}

        {summaries.length === 0 ? (
          <p className="empty">
            {filtering
              ? `No ${tab.label.toLowerCase()} match.`
              : all.length
                ? `No ${tab.label.toLowerCase()} yet. New ones appear here when the request form is submitted.`
                : "No campaigns yet. New ones appear here when the request form is submitted."}
          </p>
        ) : (
          <ul className="-mx-2">
            {summaries.map(({ campaign, totals, posts, engagementRate }) => (
              <li key={campaign.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="group grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_0.7fr_0.45fr_0.45fr] items-center gap-x-6 gap-y-2 rounded-control px-2 py-4 transition-colors hover:bg-wash-neutral"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted truncate">
                      {campaign.artist}
                      {(partnersOf.get(campaign.id) ?? []).length > 0 && (
                        <span> · {partnersOf.get(campaign.id)!.join(", ")}</span>
                      )}
                    </p>
                    <h2 className="mt-0.5 font-display text-[15px] font-bold tracking-[0.02em] group-hover:text-fb-red transition-colors">
                      {campaign.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StatusTag status={campaign.status} />
                      <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
                    </div>
                  </div>
                  <div className="text-right md:text-left">
                    <p className="tile-label">Views</p>
                    <p className="tile-value text-fb-red">{posts ? compact(totals.views) : "—"}</p>
                  </div>
                  <div className="max-md:hidden">
                    <p className="tile-label">Posts live</p>
                    <p className="tile-value text-[22px]">{posts}</p>
                  </div>
                  <div className="max-md:hidden">
                    <p className="tile-label">Engagement</p>
                    <p className="tile-value text-[22px]">{posts ? pct(engagementRate) : "—"}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="section-title">Manual upload</h2>
      <section aria-label="Manual upload">
        <ManualCampaign key={tab.key} sample={isSampleMode()} type={tab.type} />
      </section>
    </TeamShell>
  );
}
