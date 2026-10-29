// Table and field names in Airtable. If you rename something in Airtable, change it here too.
export const TABLES = {
  creators: "Creators",
  campaigns: "Campaigns",
  posts: "Posts",
  snapshots: "Snapshots",
  assignments: "Campaign Creators",
  drafts: "Drafts",
} as const;

export const CREATOR_FIELDS = {
  name: "Name",
  photo: "Photo",
  instagram: "Instagram Handle",
  tiktok: "TikTok Handle",
  instagramFollowers: "Instagram Followers",
  tiktokFollowers: "TikTok Followers",
  tags: "Tags",
  location: "Location",
  rate: "Rate",
  email: "Email",
  notes: "Notes",
  avgViews: "Avg Views",
  statsUpdated: "Stats Updated",
} as const;

export const CAMPAIGN_FIELDS = {
  name: "Name",
  artist: "Artist",
  song: "Song",
  startDate: "Start Date",
  endDate: "End Date",
  budget: "Budget",
  status: "Status",
  creators: "Creators",
  sharingEnabled: "Sharing Enabled",
  stage: "Stage",
  brief: "Brief",
  showRates: "Show Rates",
  // Optional single select: Influencer, Content Seeding. Without it the hub guesses from the name.
  type: "Type",
  // Optional long text: partner names and emails from the request form. Team only.
  partnerContacts: "Partner Contacts",
} as const;

export const ASSIGNMENT_FIELDS = {
  label: "Label",
  campaign: "Campaign",
  creator: "Creator",
  status: "Status",
  fee: "Fee",
  partnerComment: "Partner Comment",
  reviewedBy: "Reviewed By",
  reviewedAt: "Reviewed At",
  campaignRecordId: "Campaign Record ID",
  // Optional checkbox: the creator has been paid for this campaign. Team only.
  paid: "Paid",
} as const;

export const DRAFT_FIELDS = {
  label: "Label",
  assignment: "Campaign Creator",
  campaign: "Campaign",
  creator: "Creator",
  videoUrl: "Video URL",
  caption: "Caption",
  version: "Version",
  status: "Status",
  partnerComment: "Partner Comment",
  reviewedBy: "Reviewed By",
  submittedAt: "Submitted At",
  reviewedAt: "Reviewed At",
  campaignRecordId: "Campaign Record ID",
  // Optional single line text field. Leave it out of Airtable and the hub skips it.
  submittedBy: "Submitted By",
  // Optional single line text: where the draft will be posted, e.g. "TikTok, Instagram".
  platforms: "Platforms",
} as const;

export const POST_FIELDS = {
  url: "Post URL",
  platform: "Platform",
  creator: "Creator",
  campaign: "Campaign",
  postedAt: "Posted Date",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  lastRefreshed: "Last Refreshed",
  refreshNote: "Refresh Note",
  status: "Status",
} as const;

export const SNAPSHOT_FIELDS = {
  post: "Post",
  campaign: "Campaign",
  // Plain text copy of the campaign's record ID, written by the refresh job so reads can filter fast
  campaignRecordId: "Campaign Record ID",
  capturedAt: "Captured At",
  views: "Views",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
} as const;

/** The Airtable form partners use to request a campaign (saves to the operations base). */
export const REQUEST_FORM_URL = "https://airtable.com/applP9sX2S8LkcG8O/pagOSm0gYzYVr4vHx/form";

export function isSampleMode() {
  return !process.env.AIRTABLE_TOKEN || !process.env.AIRTABLE_BASE_ID;
}
