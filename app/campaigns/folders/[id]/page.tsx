import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamShell } from "@/components/Header";
import { PageHead } from "@/components/nest/Rail";
import { CopyButton } from "@/components/campaign/TeamControls";
import { AddToFolder, FolderHeaderControls, RemoveFromFolder } from "@/components/campaign/FolderControls";
import { StatusTag } from "@/components/StatusTag";
import { folderSignature } from "@/lib/auth";
import { getCampaignSummaries } from "@/lib/data";
import { getFolder, isFolderId } from "@/lib/folders";
import { compact, dateRange, timeAgo } from "@/lib/format";
import { siteOrigin } from "@/lib/origin";
import { campaignType } from "@/lib/types";

export const dynamic = "force-dynamic";

// Team view of a folder: edit what's in it. Campaigns open their team dashboards.
export default async function FolderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const folder = isFolderId(id) ? await getFolder(id) : undefined;
  if (!folder) notFound();

  const [all, origin, sig] = await Promise.all([getCampaignSummaries(), siteOrigin(), folderSignature(folder.id)]);
  const byId = new Map(all.map((s) => [s.campaign.id, s]));
  const inside = folder.campaignIds.map((cid) => byId.get(cid)).filter((s): s is (typeof all)[number] => Boolean(s));
  const shareUrl = `${origin}/share/folder/${folder.id}/${sig}`;
  const notShared = inside.filter((s) => !s.campaign.sharingEnabled);
  const options = all
    .filter((s) => !folder.campaignIds.includes(s.campaign.id))
    .map((s) => ({
      id: s.campaign.id,
      label: `${s.campaign.name}${s.campaign.artist ? ` (${s.campaign.artist})` : ""}`,
      group: campaignType(s.campaign) === "Influencer" ? "Influencer Campaigns" : "Content Seeding Campaigns",
    }));

  return (
    <TeamShell active="campaigns">
      <p className="text-sm">
        <Link href="/campaigns?type=folders" className="text-secondary hover:text-fb-red">
          ← All folders
        </Link>
      </p>
      <PageHead title={folder.name}>
        <a href={shareUrl} target="_blank" rel="noreferrer" className="btn">
          Preview shareable page
        </a>
        <CopyButton text={shareUrl} label="Copy shareable link" copiedLabel="Link copied" variant="button" />
        <FolderHeaderControls key={folder.name} id={folder.id} name={folder.name} />
      </PageHead>
      <p className="banner mt-3.5 max-w-prose">
        The shareable link lists every campaign in this folder. Partners who open a campaign from it go to that
        campaign&apos;s own share link, so they only see what a campaign link shows.
        {notShared.length > 0 &&
          ` ${notShared.length} campaign${notShared.length === 1 ? " has" : "s have"} sharing turned off, so ${notShared.length === 1 ? "it shows" : "they show"} as “not shared yet” on the link.`}
      </p>

      <section className="card" aria-label="Campaigns in this folder">
        <AddToFolder id={folder.id} options={options} />
        {inside.length === 0 ? (
          <p className="empty">This folder is empty. Add a campaign above, or from the ⋯ menu on the campaigns list.</p>
        ) : (
          <ul className="-mx-2 mt-2">
            {inside.map(({ campaign, totals, posts }) => (
              <li key={campaign.id} className="flex items-center gap-2 border-b border-line pr-2 last:border-b-0">
                <Link
                  href={`/campaigns/${campaign.id}`}
                  className="group grid min-w-0 flex-1 grid-cols-[1fr_auto] items-center gap-x-6 rounded-control px-2 py-4 transition-colors hover:bg-wash-neutral"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted">
                      {campaign.artist} · {campaignType(campaign)}
                    </p>
                    <h2 className="mt-0.5 font-display text-[15px] font-bold tracking-[0.02em] transition-colors group-hover:text-fb-red">
                      {campaign.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StatusTag status={campaign.status} />
                      <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
                      {!campaign.sharingEnabled && <span>· Sharing off</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tile-label">Views</p>
                    <p className="tile-value text-fb-red">{posts ? compact(totals.views) : "—"}</p>
                  </div>
                </Link>
                <RemoveFromFolder id={folder.id} campaignId={campaign.id} name={campaign.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="mt-3 text-xs text-muted">Updated {timeAgo(folder.updatedAt)}</p>
    </TeamShell>
  );
}
