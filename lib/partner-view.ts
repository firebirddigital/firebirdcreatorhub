// What partners (labels, managers, artist teams) are allowed to see. Server-side only.
// Used by the partner share page and the partner wrap report so both strip the same things.
import type { Assignment, Campaign, CampaignView, Creator } from "./types";

/** No budget, no brief, no partner contacts. */
export const partnerCampaign = (c: Campaign): Campaign => ({ ...c, budget: undefined, brief: undefined, partnerContacts: undefined });

/** No email or notes; the creator's rate only when the campaign shows rates. */
export const partnerCreator = (c: Creator | undefined, showFees: boolean): Creator | undefined =>
  c && { ...c, email: undefined, notes: undefined, rate: showFees ? c.rate : undefined };

/** "Jane Doe <jane@label.com>" → "Jane Doe": partners sharing a link see each other's names, not emails. */
export const reviewerName = (r?: string) => r?.replace(/\s*<[^>]*>\s*$/, "").trim() || undefined;

export const partnerAssignment = (a: Assignment, showFees: boolean): Assignment => ({
  ...a,
  creator: partnerCreator(a.creator, showFees),
  fee: showFees ? a.fee : undefined,
  paid: undefined,
  reviewedBy: reviewerName(a.reviewedBy),
});

/** Live results for partners: no refresh notes, no budget, and money only from fees when rates are shown. */
export function partnerView(view: CampaignView, showFees: boolean): CampaignView {
  return {
    ...view,
    campaign: partnerCampaign(view.campaign),
    posts: view.posts.map((p) => ({
      ...p,
      refreshNote: undefined,
      creator: partnerCreator(p.creator, showFees),
      cost: showFees && p.cost?.basis === "fee" ? p.cost : undefined,
    })),
    topCreators: view.topCreators.map((c) => ({
      ...c,
      creator: partnerCreator(c.creator, showFees),
      fee: showFees ? c.fee : undefined,
    })),
    incoming: view.incoming.map((i) => ({ ...i, creator: partnerCreator(i.creator, showFees) })),
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
  const { email: _email, notes: _notes, rate, statsUpdated: _updated, ...rest } = c;
  return opts.rates && rate ? { ...rest, rate } : rest;
}
