export type Platform = "instagram" | "tiktok";

export interface Creator {
  id: string;
  name: string;
  photo?: string;
  instagram?: string;
  tiktok?: string;
  instagramFollowers: number;
  tiktokFollowers: number;
  tags: string[];
  location?: string;
  rate?: number;
  email?: string;
  notes?: string;
  avgViews?: number;
  statsUpdated?: string;
}

export type CampaignStatus = "Planning" | "Live" | "Wrapped";
export type Stage = "creators" | "drafts" | "live";

export interface Campaign {
  id: string;
  name: string;
  artist: string;
  song?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  status: CampaignStatus;
  creatorIds: string[];
  sharingEnabled: boolean;
  stage?: Stage;
  brief?: string;
  showRates: boolean;
  /** From the Type field. Empty when it isn't set (or the field doesn't exist yet); see campaignType(). */
  type?: CampaignType;
  /** Partner names and emails from the request form. Team only: stripped from partner pages. */
  partnerContacts?: string;
}

export type CampaignType = "Influencer" | "Content Seeding";
export const CAMPAIGN_TYPES: CampaignType[] = ["Influencer", "Content Seeding"];

/** Influencer or Content Seeding: the Type field if set, otherwise "seeding" in the name or song means Content Seeding. */
export function campaignType(c: Pick<Campaign, "type" | "name" | "song">): CampaignType {
  if (c.type) return c.type;
  return /seed/i.test(`${c.name} ${c.song ?? ""}`) ? "Content Seeding" : "Influencer";
}

export type AssignmentStatus = "Proposed" | "Approved" | "Changes requested" | "Declined";

/** A creator proposed for (or booked on) a campaign. */
export interface Assignment {
  id: string;
  campaignId: string;
  creatorId?: string;
  creator?: Creator;
  status: AssignmentStatus;
  fee?: number;
  partnerComment?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  /** Marked by the team once the creator has been paid. Team only. */
  paid?: boolean;
}

export type DraftStatus = "Pending review" | "Approved" | "Changes requested";

export interface Draft {
  id: string;
  assignmentId?: string;
  campaignId?: string;
  creatorId?: string;
  creator?: Creator;
  videoUrl?: string;
  caption?: string;
  version: number;
  status: DraftStatus;
  partnerComment?: string;
  reviewedBy?: string;
  submittedAt?: string;
  reviewedAt?: string;
  /** "Firebird team" when the team added it for the creator. Empty for the creator's own uploads. */
  submittedBy?: string;
  /** Where the draft will be posted, e.g. ["TikTok", "Instagram"]. */
  platforms?: DraftPlatform[];
}

export type DraftPlatform = "TikTok" | "Instagram" | "YouTube";
export const DRAFT_PLATFORMS: DraftPlatform[] = ["TikTok", "Instagram", "YouTube"];
/** "TikTok, Instagram" (or an Airtable multiple select) → the platforms we know. */
export const parsePlatforms = (v: unknown): DraftPlatform[] => {
  const raw = Array.isArray(v) ? v.join(",") : typeof v === "string" ? v : "";
  return DRAFT_PLATFORMS.filter((p) => new RegExp(`\\b${p}\\b`, "i").test(raw));
};

export interface Stats {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface Post extends Stats {
  id: string;
  url: string;
  platform: Platform;
  creatorId?: string;
  campaignId?: string;
  postedAt?: string;
  lastRefreshed?: string;
  refreshNote?: string;
  status: "Live" | "Removed";
}

export interface Snapshot extends Stats {
  id: string;
  postId: string;
  campaignId?: string;
  capturedAt: string;
}

export interface SeriesPoint {
  date: string; // YYYY-MM-DD, or a full ISO time while the campaign has only one day of refreshes
  views: number;
  /** The zero-views starting point on the first post date, not a measured refresh. */
  estimated?: boolean;
}

export interface CreatorPerformance {
  creator?: Creator;
  creatorId?: string;
  platforms: Platform[];
  posts: number;
  views: number;
  engagementRate: number;
  /** Views on posts by this creator vs what their usual (last 10 posts) average predicts. */
  benchmark?: Benchmark;
  /** Approved fee for this campaign. Team only. */
  fee?: number;
}

/** A creator's results across every campaign they've posted in. Team only. */
export interface TrackRecord {
  campaigns: number;
  posts: number;
  views: number;
  benchmark?: Benchmark;
}

/** Actual views against expected: the creator's usual average views × number of posts. */
export interface Benchmark {
  views: number;
  expected: number;
}

export interface CampaignView {
  campaign: Campaign;
  posts: (Post & {
    creator?: Creator;
    /** What this post cost: the creator's fee (or rate, if no fee) split across their posts here. Team, or partners with fees shown. */
    cost?: { amount: number; basis: "fee" | "rate"; splitAcross: number };
  })[];
  totals: Stats & { posts: number; engagementRate: number; creators: number };
  series: SeriesPoint[];
  topCreators: CreatorPerformance[];
  lastRefreshed?: string;
  /** All posts whose creator has a usual average, against that average. */
  benchmark?: Benchmark;
  /** What the campaign cost: approved creator fees when entered, otherwise the budget. Team only. */
  spend?: { amount: number; basis: "fees" | "budget" };
  /** Approved creator fees against the budget, and how much of it is marked paid. Team only (partners: fees only, with rates shown). */
  spent?: { fees: number; paid: number; creators: number; paidCreators: number; unpriced: number; budget?: number };
  /** Approved creators' cost per post ÷ their avg views × 1,000. Team only (partners with rates shown). */
  expected?: { cpm?: number; counted: number; total: number };
  /** Creators whose latest draft is approved but who have no live post on this campaign yet. */
  incoming: IncomingPost[];
}

export interface IncomingPost {
  assignmentId: string;
  creator?: Creator;
  /** The approved draft's version and when it was approved. */
  version: number;
  approvedAt?: string;
}
