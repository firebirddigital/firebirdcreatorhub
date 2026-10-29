import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RosterPage } from "@/components/RosterPage";
import { rosterLinkKind } from "@/lib/auth";
import { getCreators } from "@/lib/data";
import { rosterCreator } from "@/lib/partner-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Firebird creators", robots: { index: false, follow: false } };

// Shareable creators showcase for labels, managers and artist teams. Emails, notes and track records
// are stripped here, before anything reaches the browser; rates only on the "with rates" link.
export default async function SharedRosterPage({ params }: { params: Promise<{ sig: string }> }) {
  const { sig } = await params;
  const kind = await rosterLinkKind(sig);
  if (!kind) notFound();
  const rates = kind === "rates";
  return <RosterPage creators={(await getCreators()).map((c) => rosterCreator(c, { rates }))} showRates={rates} />;
}
