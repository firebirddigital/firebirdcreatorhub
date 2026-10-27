import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RosterPage } from "@/components/RosterPage";
import { isValidRoster } from "@/lib/auth";
import { getCreators } from "@/lib/data";
import { rosterCreator } from "@/lib/partner-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Firebird creators", robots: { index: false, follow: false } };

// Shareable creators showcase for labels, managers and artist teams. Emails, notes, rates and
// track records are stripped here, before anything reaches the browser.
export default async function SharedRosterPage({ params }: { params: Promise<{ sig: string }> }) {
  const { sig } = await params;
  if (!(await isValidRoster(sig))) notFound();
  return <RosterPage creators={(await getCreators()).map(rosterCreator)} />;
}
