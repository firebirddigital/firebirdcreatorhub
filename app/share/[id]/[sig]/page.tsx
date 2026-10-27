import type { Metadata } from "next";
import { signDraftUrls } from "@/lib/blob";
import { notFound } from "next/navigation";
import { buildLanes, DraftsBody, DraftsHero } from "@/components/campaign/DraftsStage";
import { CreatorsBody, CreatorsHero } from "@/components/campaign/CreatorsStage";
import { CampaignShell, parseTab } from "@/components/campaign/Shell";
import { LiveBody, LiveHero } from "@/components/CampaignDashboard";
import { Logo } from "@/components/Logo";
import { isValidShare } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { campaignStage, getAssignments, getCampaign, getCampaignView, getDrafts } from "@/lib/data";
import type { Assignment, CampaignView, Creator } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

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
  const cleanCreator = (c?: Creator): Creator | undefined =>
    c && { ...c, email: undefined, notes: undefined, rate: showFees ? c.rate : undefined };
  const cleanAssignment = (a: Assignment): Assignment => ({
    ...a,
    creator: cleanCreator(a.creator),
    fee: showFees ? a.fee : undefined,
  });

  const current = campaignStage(campaign);
  const tab = parseTab(sp.tab) ?? current;
  const basePath = `/share/${id}/${sig}`;
  const partner = { reviewEndpoint: `/api/share/${id}/${sig}/review` };
  const safeCampaign = { ...campaign, budget: undefined, brief: undefined };

  let hero: React.ReactNode;
  let body: React.ReactNode;

  if (tab === "creators") {
    const roster = (await getAssignments(id)).map(cleanAssignment);
    hero = <CreatorsHero roster={roster} showFees={showFees} />;
    body = <CreatorsBody roster={roster} showFees={showFees} partner={partner} />;
  } else if (tab === "drafts") {
    const [roster, drafts] = await Promise.all([getAssignments(id), getDrafts(id).then(signDraftUrls)]);
    const lanes = buildLanes(roster.map(cleanAssignment), drafts.map((d) => ({ ...d, creator: cleanCreator(d.creator) })));
    hero = <DraftsHero lanes={lanes} />;
    body = <DraftsBody lanes={lanes} partner={partner} />;
  } else {
    const view = await getCampaignView(campaign);
    const safe: CampaignView = {
      ...view,
      campaign: safeCampaign,
      posts: view.posts.map((p) => ({ ...p, refreshNote: undefined, creator: cleanCreator(p.creator) })),
      topCreators: view.topCreators.map((c) => ({ ...c, creator: cleanCreator(c.creator) })),
    };
    hero = <LiveHero view={safe} internal={false} />;
    body = <LiveBody view={safe} internal={false} sample={isSampleMode()} />;
  }

  return (
    <>
      <header className="bg-fb-black px-[57px] max-sm:px-6 pt-[57px] max-sm:pt-8">
        <Logo variant="white" />
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
