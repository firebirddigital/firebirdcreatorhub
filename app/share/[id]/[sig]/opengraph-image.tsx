import { isValidShare } from "@/lib/auth";
import { getCampaign, getCampaignView } from "@/lib/data";
import { compact } from "@/lib/format";
import { OG_SIZE, ogImage } from "@/lib/og";

export const alt = "Campaign results from Firebird";
export const size = OG_SIZE;
export const contentType = "image/png";

// A campaign share link's preview: the campaign name and its live views. Only for valid, shared links;
// anything else gets the plain Firebird card.
export default async function Image({ params }: { params: Promise<{ id: string; sig: string }> }) {
  const { id, sig } = await params;
  const campaign = (await isValidShare(id, sig)) ? await getCampaign(id) : undefined;
  if (!campaign?.sharingEnabled) return ogImage({ headline: "Creator Hub", caption: "Creator campaign results" });
  const { totals } = await getCampaignView(campaign);
  return ogImage({
    eyebrow: `${campaign.artist}${campaign.song ? `, “${campaign.song}”` : ""}`,
    headline: campaign.name,
    figure: totals.posts ? compact(totals.views) : undefined,
    caption: totals.posts ? `views across ${totals.posts} ${totals.posts === 1 ? "post" : "posts"}` : "Creator campaign",
  });
}
