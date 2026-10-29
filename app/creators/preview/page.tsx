import type { Metadata } from "next";
import { RosterPage } from "@/components/RosterPage";
import { getCreators } from "@/lib/data";
import { rosterCreator } from "@/lib/partner-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview: shareable creators page", robots: { index: false, follow: false } };

// Team only (behind the login): the shareable creators page exactly as partners see it.
// ?rates=1 previews the "with rates" link.
export default async function RosterPreviewPage({ searchParams }: { searchParams: Promise<{ rates?: string }> }) {
  const rates = (await searchParams).rates === "1";
  return <RosterPage creators={(await getCreators()).map((c) => rosterCreator(c, { rates }))} showRates={rates} preview />;
}
