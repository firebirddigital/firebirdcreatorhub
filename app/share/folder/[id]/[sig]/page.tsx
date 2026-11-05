import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StatusTag } from "@/components/StatusTag";
import { isValidFolderShare, shareSignature } from "@/lib/auth";
import { REQUEST_FORM_URL } from "@/lib/config";
import { getCampaignSummaries } from "@/lib/data";
import { getFolder, isFolderId } from "@/lib/folders";
import { compact, dateRange } from "@/lib/format";

export const dynamic = "force-dynamic";

async function load(id: string, sig: string) {
  if (!isFolderId(id) || !(await isValidFolderShare(id, sig))) return undefined;
  return getFolder(id);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; sig: string }> }): Promise<Metadata> {
  const { id, sig } = await params;
  const folder = await load(id, sig);
  if (!folder) return { robots: { index: false, follow: false } };
  return {
    title: folder.name,
    description: "Creator campaigns from Firebird.",
    openGraph: { title: folder.name, siteName: "Firebird" },
    robots: { index: false, follow: false },
  };
}

// Partner-facing folder: names, artists, status, dates and views only. Each campaign opens its own
// share link, which does its own stripping; campaigns with sharing off are listed but not linked.
export default async function FolderSharePage({ params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params;
  const folder = await load(id, sig);
  if (!folder) notFound();

  const all = await getCampaignSummaries();
  const byId = new Map(all.map((s) => [s.campaign.id, s]));
  const inside = await Promise.all(
    folder.campaignIds
      .map((cid) => byId.get(cid))
      .filter((s): s is (typeof all)[number] => Boolean(s))
      .map(async (s) => ({
        ...s,
        href: s.campaign.sharingEnabled ? `/share/${s.campaign.id}/${await shareSignature(s.campaign.id)}` : undefined,
      })),
  );

  return (
    <main className="app public-page">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-6 py-2">
        <Logo />
        <a href={REQUEST_FORM_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
          Request a campaign
        </a>
      </header>
      <h1 className="headline text-4xl max-sm:text-3xl max-w-5xl">{folder.name}</h1>
      <p className="mt-2 text-sm text-secondary">
        {inside.length} campaign{inside.length === 1 ? "" : "s"}. Open one to see its creators, drafts and results.
      </p>

      <section className="card mt-5" aria-label="Campaigns">
        {inside.length === 0 ? (
          <p className="empty">No campaigns in this folder yet.</p>
        ) : (
          <ul className="-mx-2">
            {inside.map(({ campaign, totals, posts, href }) => {
              const body = (
                <>
                  <div className="min-w-0">
                    <p className="truncate text-xs text-muted">
                      {campaign.artist}
                      {campaign.song ? `, “${campaign.song}”` : ""}
                    </p>
                    <h2 className="mt-0.5 font-display text-[15px] font-bold tracking-[0.02em] transition-colors group-hover:text-fb-red">
                      {campaign.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StatusTag status={campaign.status} />
                      <span>{dateRange(campaign.startDate, campaign.endDate)}</span>
                      {!href && <span>· Not shared yet</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tile-label">Views</p>
                    <p className="tile-value text-fb-red">{posts ? compact(totals.views) : "—"}</p>
                  </div>
                </>
              );
              const cls = "grid grid-cols-[1fr_auto] items-center gap-x-6 rounded-control px-2 py-4";
              return (
                <li key={campaign.id} className="border-b border-line last:border-b-0">
                  {href ? (
                    <a href={href} className={`group ${cls} transition-colors hover:bg-wash-neutral`}>
                      {body}
                    </a>
                  ) : (
                    <div className={`${cls} opacity-70`}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
        Live stats refresh daily from public post data and can lag the apps by up to 24 hours.
      </footer>
    </main>
  );
}
