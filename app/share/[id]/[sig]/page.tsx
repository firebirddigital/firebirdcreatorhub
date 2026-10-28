import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildLanes, DraftsBody, DraftsHero } from "@/components/campaign/DraftsStage";
import { CreatorsBody, CreatorsHero } from "@/components/campaign/CreatorsStage";
import { CampaignShell, parseTab } from "@/components/campaign/Shell";
import { LiveBody, LiveHero } from "@/components/CampaignDashboard";
import { Logo } from "@/components/Logo";
import { isValidShare } from "@/lib/auth";
import { signDraftUrls } from "@/lib/blob";
import { isSampleMode, REQUEST_FORM_URL } from "@/lib/config";
import { campaignStage, getAssignments, getCampaign, getCampaignView, getDrafts } from "@/lib/data";
import { partnerAssignment, partnerCampaign, partnerCreator, partnerView, reviewerName } from "@/lib/partner-view";
import { getStreams } from "@/lib/streams";
import type { Assignment, Creator } from "@/lib/types";

export const dynamic = "force-dynamic";
// The link preview's title is the campaign's name; only for valid links to campaigns that are shared.
export async function generateMetadata({ params }: { params: Promise<{ id: string; sig: string }> }): Promise<Metadata> {
  const { id, sig } = await params;
  const campaign = (await isValidShare(id, sig)) ? await getCampaign(id) : undefined;
  if (!campaign?.sharingEnabled) return { robots: { index: false, follow: false } };
  const description = `${campaign.artist}${campaign.song ? `, “${campaign.song}”` : ""}. Creator campaign results from Firebird.`;
  return {
    title: campaign.name,
    description,
    openGraph: { title: campaign.name, description, siteName: "Firebird" },
    twitter: { card: "summary_large_image", title: campaign.name, description },
    robots: { index: false, follow: false },
  };
}

// Partner-facing campaign page. Everything internal is stripped here, before it reaches the browser.
export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sig: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id, sig }, sp] = await Promise.all([params, searchParams]);
  if (!(await isValidShare(id, sig))) notFound();
  const campaign = await getCampaign(id);
  if (!campaign || !campaign.sharingEnabled) notFound();

  const showFees = campaign.showRates;
  const cleanCreator = (c?: Creator) => partnerCreator(c, showFees);
  const cleanAssignment = (a: Assignment) => partnerAssignment(a, showFees);

  const current = campaignStage(campaign);
  const tab = parseTab(sp.tab) ?? current;
  const basePath = `/share/${id}/${sig}`;
  const partner = { reviewEndpoint: `/api/share/${id}/${sig}/review` };
  const safeCampaign = partnerCampaign(campaign);

  let hero: React.ReactNode;
  let body: React.ReactNode;

  if (tab === "creators") {
    const roster = (await getAssignments(id)).map(cleanAssignment);
    hero = <CreatorsHero roster={roster} showFees={showFees} />;
    body = <CreatorsBody roster={roster} showFees={showFees} partner={partner} />;
  } else if (tab === "drafts") {
    const [roster, drafts] = await Promise.all([getAssignments(id), getDrafts(id).then(signDraftUrls)]);
    const lanes = buildLanes(
      roster.map(cleanAssignment),
      drafts.map((d) => ({ ...d, creator: cleanCreator(d.creator), reviewedBy: reviewerName(d.reviewedBy) })),
    );
    hero = <DraftsHero lanes={lanes} />;
    body = <DraftsBody lanes={lanes} partner={partner} showFees={showFees} />;
  } else {
    const [view, streams] = await Promise.all([getCampaignView(campaign), getStreams(id)]);
    const safe = partnerView(view, showFees);
    hero = <LiveHero view={safe} internal={false} />;
    body = (
      <>
        <a
          href={`${basePath}/report`}
          className="subtitle inline-block border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors"
        >
          Download wrap report
        </a>
        <LiveBody
          view={safe}
          internal={false}
          sample={isSampleMode()}
          streams={streams?.shareWithPartner ? streams : undefined}
        />
      </>
    );
  }

  return (
    <>
      <header className="bg-fb-black px-[57px] max-sm:px-6 pt-[57px] max-sm:pt-8 flex flex-wrap items-start justify-between gap-6">
        <Logo variant="white" />
        <a
          href={REQUEST_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="subtitle border-2 border-fb-white px-5 py-2.5 text-sm text-fb-white hover:bg-fb-white hover:text-fb-black transition-colors"
        >
          Request a campaign
        </a>
      </header>
      <CampaignShell campaign={safeCampaign} tab={tab} current={current} basePath={basePath} hero={hero}>
        {body}
      </CampaignShell>
      <footer className="px-[57px] max-sm:px-6 pb-14 text-sm">
        Live stats refresh daily from public post data and can lag the apps by up to 24 hours.
      </footer>
    </>
  );
}
