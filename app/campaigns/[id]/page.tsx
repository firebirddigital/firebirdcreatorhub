import { notFound } from "next/navigation";
import { buildLanes, DraftsBody, DraftsHero } from "@/components/campaign/DraftsStage";
import { CreatorsBody, CreatorsHero } from "@/components/campaign/CreatorsStage";
import { CampaignEditor } from "@/components/campaign/CampaignEditor";
import { CampaignShell, parseTab } from "@/components/campaign/Shell";
import { RosterTools } from "@/components/campaign/TeamControls";
import { LiveBody, LiveHero } from "@/components/CampaignDashboard";
import { CampaignTools } from "@/components/CampaignTools";
import { Header } from "@/components/Header";
import { shareSignature, submitSignature } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { campaignStage, getAssignments, getCampaign, getCampaignView, getCreators, getDrafts } from "@/lib/data";
import { siteOrigin } from "@/lib/origin";
import type { Assignment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const sample = isSampleMode();
  const current = campaignStage(campaign);
  const tab = parseTab(sp.tab) ?? current;
  const origin = await siteOrigin();
  const shareUrl = campaign.sharingEnabled
    ? `${origin}/share/${campaign.id}/${await shareSignature(campaign.id)}`
    : undefined;

  const uploadUrlsFor = async (roster: Assignment[]) =>
    Object.fromEntries(
      await Promise.all(roster.map(async (a) => [a.id, `${origin}/submit/${a.id}/${await submitSignature(a.id)}`])),
    ) as Record<string, string>;

  const rosterTools = async (roster: Assignment[]) => {
    const creators = await getCreators();
    return (
      <RosterTools
        campaignId={campaign.id}
        roster={creators.map(({ id, name, instagram, tiktok, instagramFollowers, tiktokFollowers, tags }) => ({
          id,
          name,
          instagram,
          tiktok,
          instagramFollowers,
          tiktokFollowers,
          tags,
        }))}
        onCampaign={roster.map((a) => a.creatorId).filter((x): x is string => Boolean(x))}
        current={current}
        shareUrl={shareUrl}
        sample={sample}
      />
    );
  };

  let hero: React.ReactNode;
  let body: React.ReactNode;

  if (tab === "creators") {
    const roster = await getAssignments(id);
    hero = <CreatorsHero roster={roster} showFees />;
    body = (
      <CreatorsBody
        roster={roster}
        showFees
        team={{ campaignId: id, uploadUrls: await uploadUrlsFor(roster), tools: await rosterTools(roster) }}
      />
    );
  } else if (tab === "drafts") {
    const [roster, drafts] = await Promise.all([getAssignments(id), getDrafts(id)]);
    const lanes = buildLanes(roster, drafts);
    hero = <DraftsHero lanes={lanes} />;
    body = (
      <DraftsBody lanes={lanes} team={{ uploadUrls: await uploadUrlsFor(roster), tools: await rosterTools(roster) }} />
    );
  } else {
    const [view, creators] = await Promise.all([getCampaignView(campaign), getCreators()]);
    const onCampaign = new Set(campaign.creatorIds);
    const pickerCreators = [
      ...creators.filter((c) => onCampaign.has(c.id)),
      ...creators.filter((c) => !onCampaign.has(c.id)),
    ].map(({ id, name }) => ({ id, name }));
    hero = <LiveHero view={view} internal />;
    body = (
      <LiveBody
        view={view}
        internal
        sample={sample}
        tools={
          <CampaignTools
            campaignId={campaign.id}
            creators={pickerCreators}
            shareUrl={shareUrl}
            lastRefreshed={view.lastRefreshed}
            sample={sample}
          />
        }
      />
    );
  }

  return (
    <>
      <Header active="campaigns" />
      <CampaignShell campaign={campaign} tab={tab} current={current} basePath={`/campaigns/${id}`} hero={hero}>
        <CampaignEditor key={JSON.stringify(campaign)} campaign={campaign} stage={current} sample={sample} />
        {body}
      </CampaignShell>
    </>
  );
}
