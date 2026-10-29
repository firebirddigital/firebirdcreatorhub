import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WrapReport } from "@/components/WrapReport";
import { isValidShare } from "@/lib/auth";
import { getCampaign, getCampaignView } from "@/lib/data";
import { getStreams } from "@/lib/streams";
import { partnerView } from "@/lib/partner-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign wrap", robots: { index: false, follow: false } };

// Partner wrap report, reached from the share link. Same stripping as the share page.
export default async function PartnerReportPage({ params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params;
  if (!(await isValidShare(id, sig))) notFound();
  const campaign = await getCampaign(id);
  if (!campaign || !campaign.sharingEnabled) notFound();
  const [view, streams] = await Promise.all([getCampaignView(campaign), getStreams(id)]);
  return (
    <WrapReport
      view={partnerView(view, campaign.showRates)}
      audience="partner"
      streams={streams?.shareWithPartner ? streams : undefined}
    />
  );
}
