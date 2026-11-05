import Link from "next/link";
import { Suspense } from "react";
import { CampaignFilters } from "@/components/CampaignFilters";
import { RequestImport } from "@/components/RequestImport";
import { TeamShell } from "@/components/Header";
import { PageHead, SegLinks } from "@/components/nest/Rail";
import { RequestsInbox } from "@/components/RequestsInbox";
import { ManualCampaign } from "@/components/campaign/CampaignEditor";
import { CampaignRowMenu } from "@/components/campaign/CampaignRowMenu";
import { NewFolderButton } from "@/components/campaign/NewFolderButton";
import { StatusTag } from "@/components/StatusTag";
import { isSampleMode, REQUEST_FORM_URL } from "@/lib/config";
import { getAnalytics, normalize } from "@/lib/analytics";
import { artistOptions, getManualArtists } from "@/lib/artists";
import { getCampaignSummaries, lastEdited } from "@/lib/data";
import { getFolders } from "@/lib/folders";
import { getRequests, requestsDirect } from "@/lib/requests";
import { compact, dateRange, pct, timeAgo } from "@/lib/format";
import { campaignType, CAMPAIGN_STATUSES, type CampaignType } from "@/lib/types";

export const revalidate = 300;

const TABS: { key: string; type?: CampaignType; label: string }[] = [
  { key: "influencer", type: "Influencer", label: "Influencer Campaigns" },
  { key: "seeding", type: "Content Seeding", label: "Content Seeding Campaigns" },
  { key: "folders", label: "Folders" },
];

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; partner?: string; status?: string; artist?: string; sort?: string }>;
}) {
  const [all, sp, inbox, analytics, folders, manualArtists] = await Promise.all([
    getCampaignSummaries(),
    searchParams,
    getRequests(),
    getAnalytics(),
    getFolders(),
    getManualArtists(),
  ]);
  const tab = TABS.find((t) => t.key === sp.type) ?? TABS[0];

  // Partners and roster artists per campaign, through the campaign's artist (IP DB Roster).
  const partnersOf = new Map(analytics.campaigns.map((c) => [c.id, c.partners]));
  const artistsOf = new Map(analytics.campaigns.map((c) => [c.id, c.artists]));
  const artists = artistOptions(
    [...all.map((s) => s.campaign.artist), ...analytics.options.artists],
    manualArtists,
  );

  const words = (sp.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const partnerKey = sp.partner ? normalize(sp.partner) : "";
  const artistKey = sp.artist ? normalize(sp.artist) : "";
  const status = CAMPAIGN_STATUSES.find((s) => s === sp.status);
  const sortByCreated = sp.sort === "created";
  const matches = all
    .filter(({ campaign }) => {
      const text = `${campaign.name} ${campaign.artist} ${campaign.song ?? ""}`.toLowerCase();
      if (!words.every((w) => text.includes(w))) return false;
      if (status && campaign.status !== status) return false;
      if (
        artistKey &&
        normalize(campaign.artist) !== artistKey &&
        !(artistsOf.get(campaign.id) ?? []).some((a) => normalize(a) === artistKey)
      )
        return false;
      return !partnerKey || (partnersOf.get(campaign.id) ?? []).some((p) => normalize(p) === partnerKey);
    })
    .sort((a, b) =>
      sortByCreated
        ? b.campaign.createdAt.localeCompare(a.campaign.createdAt)
        : lastEdited(b.campaign).localeCompare(lastEdited(a.campaign)),
    );
  const filtering = words.length > 0 || Boolean(partnerKey || artistKey || status);
  const summaries = tab.type ? matches.filter((s) => campaignType(s.campaign) === tab.type) : [];
  const count = (t: (typeof TABS)[number]) =>
    t.type ? matches.filter((s) => campaignType(s.campaign) === t.type).length : folders.length;
  const typeFieldMissing = !isSampleMode() && all.length > 0 && all.every((s) => !s.campaign.type);
  const editedFieldMissing = !isSampleMode() && all.length > 0 && all.every((s) => !s.campaign.updatedAt);

  const folderRefs = folders.map(({ id, name, campaignIds }) => ({ id, name, campaignIds }));
  const keep = (extra: Record<string, string>) =>
    `/campaigns?${new URLSearchParams(
      Object.fromEntries(
        Object.entries({ q: sp.q, partner: sp.partner, status: sp.status, artist: sp.artist, sort: sp.sort, ...extra }).filter(
          (e): e is [string, string] => Boolean(e[1]),
        ),
      ),
    )}`;

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
            href: keep({ type: t.key }),
            label: t.label,
            active: t.key === tab.key,
            count: count(t),
          }))}
        />
      </div>

      {tab.key === "folders" ? (
        <section className="card" aria-label="Folders">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-prose text-sm text-secondary">
              Group Influencer and Content Seeding campaigns together and share the whole folder with one link. Add
              campaigns from the ⋯ menu on any campaign, or from inside a folder.
            </p>
            <NewFolderButton />
          </div>
          {folders.length === 0 ? (
            <p className="empty">No folders yet.</p>
          ) : (
            <ul className="-mx-2 mt-3">
              {folders.map((f) => {
                const inside = f.campaignIds
                  .map((id) => all.find((s) => s.campaign.id === id))
                  .filter((s): s is (typeof all)[number] => Boolean(s));
                return (
                  <li key={f.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/campaigns/folders/${f.id}`}
                      className="group grid grid-cols-[1fr_auto] items-center gap-x-6 rounded-control px-2 py-4 transition-colors hover:bg-wash-neutral"
                    >
                      <div className="min-w-0">
                        <h2 className="font-display text-[15px] font-bold tracking-[0.02em] group-hover:text-fb-red transition-colors">
                          {f.name}
                        </h2>
                        <p className="mt-1 truncate text-xs text-muted">
                          {inside.length
                            ? inside.map((s) => s.campaign.name).join(" · ")
                            : "Empty. Add campaigns from their ⋯ menu."}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="tile-label">
                          {inside.length} campaign{inside.length === 1 ? "" : "s"}
                        </p>
                        <p className="text-xs text-muted">Updated {timeAgo(f.updatedAt)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <section className="card">
          <Suspense>
            <CampaignFilters partners={analytics.options.partners} artists={artists} manualArtists={manualArtists} />
          </Suspense>
          {typeFieldMissing && (
            <p className="banner max-w-prose">
              Sorted by name for now: anything with “seeding” in the name or song counts as Content Seeding. Add a
              single select field called <strong>Type</strong> (Influencer, Content Seeding) to the Campaigns table in
              Airtable to set it per campaign from Edit campaign.
            </p>
          )}
          {editedFieldMissing && !sortByCreated && (
            <p className="banner max-w-prose">
              Sorting by date created for now. Add a <strong>Last modified time</strong> field called{" "}
              <strong>Last Modified</strong> to the Campaigns table in Airtable to sort by recently edited.
            </p>
          )}

          {summaries.length === 0 ? (
            <p className="empty">
              {artistKey && !words.length && !partnerKey && !status
                ? `No ${tab.label.toLowerCase()} for ${sp.artist} yet.`
                : artistKey
                  ? `No ${tab.label.toLowerCase()} for ${sp.artist} match.`
                  : filtering
                    ? `No ${tab.label.toLowerCase()} match.`
                    : all.length
                      ? `No ${tab.label.toLowerCase()} yet. New ones appear here when the request form is submitted.`
                      : "No campaigns yet. New ones appear here when the request form is submitted."}
            </p>
          ) : (
            <ul className="-mx-2">
              {summaries.map(({ campaign, totals, posts, engagementRate }) => (
                <li key={campaign.id} className="flex items-center gap-2 border-b border-line pr-2 last:border-b-0">
                  <Link
                    href={`/campaigns/${campaign.id}`}
                    className="group grid min-w-0 flex-1 grid-cols-[1fr_auto] md:grid-cols-[1.6fr_0.7fr_0.45fr_0.45fr] items-center gap-x-6 gap-y-2 rounded-control px-2 py-4 transition-colors hover:bg-wash-neutral"
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
                        <span title={new Date(sortByCreated ? campaign.createdAt : lastEdited(campaign)).toLocaleString("en-US")}>
                          · {sortByCreated ? "Created" : campaign.updatedAt ? "Edited" : "Created"}{" "}
                          {timeAgo(sortByCreated ? campaign.createdAt : lastEdited(campaign))}
                        </span>
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
                  <CampaignRowMenu
                    campaign={{ id: campaign.id, name: campaign.name, status: campaign.status }}
                    folders={folderRefs}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab.type && (
        <>
          <h2 className="section-title">Manual upload</h2>
          <section aria-label="Manual upload">
            <ManualCampaign key={tab.key} sample={isSampleMode()} type={tab.type} />
          </section>
        </>
      )}
    </TeamShell>
  );
}
