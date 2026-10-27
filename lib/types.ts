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
}

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
}

export interface CampaignView {
  campaign: Campaign;
  posts: (Post & { creator?: Creator })[];
  totals: Stats & { posts: number; engagementRate: number; creators: number };
  series: SeriesPoint[];
  topCreators: CreatorPerformance[];
  lastRefreshed?: string;
}
