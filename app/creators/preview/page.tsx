import type { Metadata } from "next";
import { RosterPage } from "@/components/RosterPage";
import { getCreators } from "@/lib/data";
import { rosterCreator } from "@/lib/partner-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview: shareable creators page", robots: { index: false, follow: false } };

// Team only (behind the login): the shareable creators page exactly as partners see it.
export default async function RosterPreviewPage() {
  return <RosterPage creators={(await getCreators()).map(rosterCreator)} preview />;
}
