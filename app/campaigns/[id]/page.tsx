import { notFound } from "next/navigation";
import { buildLanes, DraftsBody, DraftsHero } from "@/components/campaign/DraftsStage";
import { CreatorsBody, CreatorsHero } from "@/components/campaign/CreatorsStage";
import { CampaignEditor } from "@/components/campaign/CampaignEditor";
import { CampaignShell, parseTab } from "@/components/campaign/Shell";
import { RosterTools } from "@/components/campaign/TeamControls";
import { TeamDraftForm, type PickerCreator } from "@/components/campaign/TeamDraftForm";
import { LiveBody, LiveHero } from "@/components/CampaignDashboard";
import { CampaignTools } from "@/components/CampaignTools";
import { StreamsUpload } from "@/components/StreamsUpload";
import { Header } from "@/components/Header";
import { shareSignature, submitSignature } from "@/lib/auth";
import { signDraftUrls } from "@/lib/blob";
import { isSampleMode } from "@/lib/config";
import { campaignStage, getAssignments, getTrackRecords, getCampaign, getCampaignView, getCreators, getDrafts } from "@/lib/data";
import { siteOrigin } from "@/lib/origin";
import { emailEnabled, emailsIn } from "@/lib/notify";
import { gmailConfigured, gmailSender } from "@/lib/gmail";
import { EmailDashboard } from "@/components/campaign/EmailDashboard";
import { getStreams } from "@/lib/streams";
import { getRequests } from "@/lib/requests";
import { RequestLink } from "@/components/campaign/RequestLink";
import type { Assignment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; gmail?: string }>;
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

  const rosterTools = async (roster: Assignment[], addDraft?: React.ReactNode) => {
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
        addDraft={addDraft}
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
        team={{
          campaignId: id,
          uploadUrls: await uploadUrlsFor(roster),
          tools: await rosterTools(roster),
          trackRecords: await getTrackRecords(),
        }}
      />
    );
  } else if (tab === "drafts") {
    const [roster, drafts, creators] = await Promise.all([getAssignments(id), getDrafts(id).then(signDraftUrls), getCreators()]);
    const lanes = buildLanes(roster, drafts);
    const assignmentFor = new Map(roster.map((a) => [a.creatorId, a]));
    const pickerCreators: PickerCreator[] = creators.map(({ id: cid, name, instagram, tiktok }) => {
      const a = assignmentFor.get(cid);
      return { id: cid, name, instagram, tiktok, ...(a ? { assignment: { id: a.id, status: a.status } } : {}) };
    });
    hero = <DraftsHero lanes={lanes} />;
    body = (
      <DraftsBody
        lanes={lanes}
        team={{
          uploadUrls: await uploadUrlsFor(roster),
          tools: await rosterTools(roster, <TeamDraftForm campaignId={id} creators={pickerCreators} sample={sample} />),
          campaignId: id,
          sample,
        }}
      />
    );
  } else {
    const [view, creators, streams] = await Promise.all([getCampaignView(campaign), getCreators(), getStreams(id)]);
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
        creators={pickerCreators}
        streams={streams}
        streamsControls={
          sample ? undefined : (
            <StreamsUpload
              campaignId={campaign.id}
              hasStreams={Boolean(streams?.days.length)}
              shareWithPartner={streams?.shareWithPartner ?? false}
              uploadedAt={streams?.uploadedAt}
            />
          )
        }
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
        {campaign.partnerContacts && (
          <section aria-label="Partner contacts" className="-mt-10 text-sm">
            <p className="text-xs font-bold">Partner contacts (team only)</p>
            <p className="mt-1 whitespace-pre-line">{campaign.partnerContacts}</p>
          </section>
        )}
        <RequestLink
          campaignId={campaign.id}
          artist={campaign.artist}
          sample={sample}
          requests={(await getRequests().catch(() => ({ requests: [] }))).requests.map((r) => ({
            id: r.id,
            name: r.name,
            artist: r.artist,
            source: r.source,
            createdTime: r.createdTime,
            hubStatus: r.hubStatus,
            linked: r.hubCampaignIds.includes(campaign.id),
          }))}
        />
        <EmailDashboard
          key={campaign.partnerContacts ?? ""}
          campaignId={campaign.id}
          contacts={emailsIn(campaign.partnerContacts)}
          sharingEnabled={campaign.sharingEnabled}
          emailReady={await emailEnabled()}
          gmail={{ configured: gmailConfigured(), sender: (await gmailSender())?.email, status: sp.gmail }}
        />
        {body}
      </CampaignShell>
    </>
  );
}
