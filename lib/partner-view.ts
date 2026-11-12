// What partners (labels, managers, artist teams) are allowed to see. Server-side only.
// Used by the partner share page and the partner wrap report so both strip the same things.
import type { Assignment, Campaign, CampaignView, Creator } from "./types";

/** No budget, no brief text, no partner contacts. The brief link (Campaign Brief button) stays: partners get that. */
export const partnerCampaign = (c: Campaign): Campaign => ({ ...c, budget: undefined, brief: undefined, partnerContacts: undefined });

/** What the team has chosen to share on this campaign's partner link, beyond the basics. */
export interface PartnerShows {
  fees: boolean;
  /** Creators' engagement rate across their last 10 posts. */
  engagement: boolean;
}

/** No email or notes; the creator's rate only when the campaign shows rates; engagement rate only when allowed. */
export const partnerCreator = (c: Creator | undefined, shows: PartnerShows): Creator | undefined =>
  c && {
    ...c,
    email: undefined,
    notes: undefined,
    rate: shows.fees ? c.rate : undefined,
    engagementRate: shows.engagement ? c.engagementRate : undefined,
  };

/** "Jane Doe <jane@label.com>" → "Jane Doe": partners sharing a link see each other's names, not emails. */
export const reviewerName = (r?: string) => r?.replace(/\s*<[^>]*>\s*$/, "").trim() || undefined;

export const partnerAssignment = (a: Assignment, shows: PartnerShows): Assignment => ({
  ...a,
  creator: partnerCreator(a.creator, shows),
  fee: shows.fees ? a.fee : undefined,
  rates: shows.fees ? a.rates : undefined,
  paid: undefined,
  reviewedBy: reviewerName(a.reviewedBy),
});

/** Live results for partners: no refresh notes, no budget, and money only from fees when rates are shown. */
export function partnerView(view: CampaignView, shows: PartnerShows): CampaignView {
  const showFees = shows.fees;
  return {
    ...view,
    campaign: partnerCampaign(view.campaign),
    posts: view.posts.map((p) => ({
      ...p,
      refreshNote: undefined,
      creator: partnerCreator(p.creator, shows),
      cost: showFees && p.cost?.basis === "fee" ? p.cost : undefined,
    })),
    topCreators: view.topCreators.map((c) => ({
      ...c,
      creator: partnerCreator(c.creator, shows),
      fee: showFees ? c.fee : undefined,
    })),
    incoming: view.incoming.map((i) => ({ ...i, creator: partnerCreator(i.creator, shows) })),
    spend: showFees && view.spend?.basis === "fees" ? view.spend : undefined,
    // Partners see what was spent on creators (with rates shown), never the budget or who has been paid.
    spent: showFees && view.spent?.fees ? { ...view.spent, budget: undefined, paid: 0, paidCreators: 0 } : undefined,
    expected: showFees ? view.expected : undefined,
  };
}

/**
 * Creators on the shareable roster link: no email, notes or internal stats dates, and the rate only
 * on the link the team sent "with rates".
 */
export function rosterCreator(c: Creator, opts: { rates?: boolean } = {}): Creator {
  // Leave the fields out entirely rather than sending them blank.
  const { email: _email, notes: _notes, rate, statsUpdated: _updated, engagementRate: _eng, createdAt: _created, ...rest } = c;
  return opts.rates && rate ? { ...rest, rate } : rest;
}
