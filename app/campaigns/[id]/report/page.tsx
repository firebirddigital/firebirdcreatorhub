import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WrapReport } from "@/components/WrapReport";
import { getCampaign, getCampaignView } from "@/lib/data";
import { getStreams } from "@/lib/streams";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Campaign wrap", robots: { index: false, follow: false } };

// Team wrap report (behind the login). Includes cost per 1K views.
export default async function TeamReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();
  const [view, streams] = await Promise.all([getCampaignView(campaign), getStreams(id)]);
  return <WrapReport view={view} audience="team" streams={streams} />;
}
