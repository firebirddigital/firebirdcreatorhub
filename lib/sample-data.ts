// Fictional data so the app runs before Airtable is connected. Nothing here is a real person or artist.
import type { Assignment, Campaign, Creator, Draft, Post, Snapshot } from "./types";

const c = (
  id: string,
  name: string,
  instagram: string | undefined,
  igF: number,
  tiktok: string | undefined,
  ttF: number,
  tags: string[],
  location: string,
  rate: number,
): Creator => ({
  id,
  name,
  instagram,
  tiktok,
  instagramFollowers: igF,
  tiktokFollowers: ttF,
  tags,
  location,
  rate,
  // Made-up average views: 4–12% of followers, varied by creator, so CPM figures have something to show.
  avgViews: Math.round((igF + ttF) * (0.04 + (Number(id.slice(2)) % 5) * 0.02)),
  email: `${id}@example.com`,
});

export const sampleCreators: Creator[] = [
  c("cr01", "Maya Ortiz", "maya.moves", 412_000, "mayamoves", 1_240_000, ["Fitness", "Dance"], "Los Angeles, CA", 2200),
  c("cr02", "Jordan Pike", "jpike.trains", 186_000, "jordanpike", 540_000, ["Fitness", "Sports"], "Austin, TX", 1400),
  c("cr03", "Tess Wilder", "tesswilder", 92_000, "tess.wilder", 310_000, ["Country", "Lifestyle"], "Nashville, TN", 900),
  c("cr04", "Devon Hale", "devonhale", 640_000, "devonhale", 2_100_000, ["Comedy"], "Atlanta, GA", 4500),
  c("cr05", "Riley Brooks", "rileyruns", 58_000, "rileyruns", 140_000, ["Fitness", "Outdoors"], "Denver, CO", 600),
  c("cr06", "Sam Okafor", "samokafor", 220_000, "sam.okafor", 870_000, ["Sports", "Comedy"], "Houston, TX", 1800),
  c("cr07", "Lena Park", "lenapark.eats", 305_000, "lenaparkeats", 960_000, ["Food", "Lifestyle"], "Chicago, IL", 2000),
  c("cr08", "Cole Ramsey", "coleramsey", 41_000, "coleramsey", 410_000, ["Country", "Outdoors"], "Knoxville, TN", 700),
  c("cr09", "Ava Monroe", "avamonroe", 1_100_000, "avamonroe", 3_400_000, ["Beauty", "Fashion"], "New York, NY", 6500),
  c("cr10", "Nico Vance", "nicovance", 77_000, "nico.vance", 1_050_000, ["Dance", "Pop"], "Miami, FL", 1600),
  c("cr11", "Harper Quinn", "harperquinn", 134_000, undefined, 0, ["Fashion", "Lifestyle"], "Nashville, TN", 1100),
  c("cr12", "Marcus Bell", undefined, 0, "marcusbellhoops", 760_000, ["Sports"], "Charlotte, NC", 1300),
  c("cr13", "Ivy Chen", "ivychen.lifts", 268_000, "ivychenlifts", 690_000, ["Fitness"], "Seattle, WA", 1700),
  c("cr14", "Jake Dalton", "jakedalton", 49_000, "jakedaltonmusic", 380_000, ["Country", "Music"], "Nashville, TN", 800),
  c("cr15", "Priya Shah", "priyatravels", 510_000, "priyatravels", 450_000, ["Travel", "Lifestyle"], "San Francisco, CA", 2400),
  c("cr16", "Theo Grant", "theogrant", 26_000, "theo.gaming", 1_300_000, ["Gaming", "Comedy"], "Phoenix, AZ", 1500),
  c("cr17", "Bella Ruiz", "bellaruiz", 380_000, "bella.ruiz", 1_800_000, ["Dance", "Pop", "Beauty"], "San Diego, CA", 3200),
  c("cr18", "Owen Reed", "owenreed.golf", 162_000, "owenreedgolf", 290_000, ["Sports", "Outdoors"], "Scottsdale, AZ", 1200),
];

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export const sampleCampaigns: Campaign[] = [
  {
    id: "cmp01",
    name: "Back Roads Fall Push",
    artist: "The Copper Hours",
    song: "Back Roads",
    startDate: daysAgo(16),
    endDate: daysAgo(-14),
    budget: 24000,
    status: "Live",
    creatorIds: ["cr01", "cr02", "cr03", "cr05", "cr08", "cr13", "cr14", "cr18"],
    sharingEnabled: true,
    stage: "live",
    showRates: false,
    brief: "Use the hook from the second chorus. Show the drive, the open road, the moment the song kicks in.",
  },
  {
    id: "cmp02",
    name: "Gameday Anthem",
    artist: "Northbound",
    song: "Full Court",
    startDate: daysAgo(30),
    endDate: daysAgo(2),
    budget: 18000,
    status: "Wrapped",
    creatorIds: ["cr06", "cr12", "cr04", "cr10", "cr17", "cr16"],
    sharingEnabled: true,
    stage: "live",
    showRates: false,
  },
  {
    id: "cmp03",
    name: "Holiday Single Seeding",
    artist: "Ivy Lane",
    song: "Snow Globe",
    startDate: daysAgo(-10),
    endDate: daysAgo(-40),
    budget: 30000,
    status: "Planning",
    creatorIds: ["cr09", "cr11", "cr15", "cr07", "cr17", "cr10"],
    sharingEnabled: true,
    stage: "creators",
    showRates: true,
    brief:
      "A cosy, snowy-window feel. Open on the first line of the chorus and keep the song audible throughout. Post between Dec 1 and Dec 10.",
  },
];

// [id, campaign, creator, platform, daysAgoPosted, finalViews, likeRate, commentRate, shareRate]
type Seed = [string, string, string, "instagram" | "tiktok", number, number, number, number, number];
const seeds: Seed[] = [
  ["p01", "cmp01", "cr01", "tiktok", 15, 2_840_000, 0.092, 0.0031, 0.011],
  ["p02", "cmp01", "cr01", "instagram", 14, 690_000, 0.071, 0.0022, 0.004],
  ["p03", "cmp01", "cr02", "tiktok", 13, 812_000, 0.083, 0.0026, 0.009],
  ["p04", "cmp01", "cr03", "instagram", 12, 244_000, 0.104, 0.0041, 0.006],
  ["p05", "cmp01", "cr03", "tiktok", 11, 1_120_000, 0.118, 0.0052, 0.014],
  ["p06", "cmp01", "cr05", "tiktok", 10, 205_000, 0.067, 0.0019, 0.005],
  ["p07", "cmp01", "cr08", "tiktok", 9, 1_460_000, 0.126, 0.0063, 0.017],
  ["p08", "cmp01", "cr13", "instagram", 8, 538_000, 0.081, 0.0024, 0.005],
  ["p09", "cmp01", "cr13", "tiktok", 7, 902_000, 0.088, 0.0029, 0.008],
  ["p10", "cmp01", "cr14", "tiktok", 6, 640_000, 0.131, 0.0071, 0.012],
  ["p11", "cmp01", "cr18", "instagram", 5, 312_000, 0.059, 0.0017, 0.003],
  ["p12", "cmp01", "cr02", "instagram", 3, 188_000, 0.064, 0.0021, 0.004],
  ["p13", "cmp02", "cr06", "tiktok", 28, 1_980_000, 0.097, 0.0034, 0.013],
  ["p14", "cmp02", "cr12", "tiktok", 26, 1_210_000, 0.089, 0.0028, 0.011],
  ["p15", "cmp02", "cr04", "instagram", 25, 1_650_000, 0.112, 0.0058, 0.016],
  ["p16", "cmp02", "cr04", "tiktok", 24, 3_900_000, 0.104, 0.0047, 0.019],
  ["p17", "cmp02", "cr10", "tiktok", 22, 1_430_000, 0.093, 0.0031, 0.01],
  ["p18", "cmp02", "cr17", "tiktok", 20, 2_260_000, 0.087, 0.0026, 0.009],
  ["p19", "cmp02", "cr17", "instagram", 19, 980_000, 0.078, 0.0023, 0.005],
  ["p20", "cmp02", "cr16", "tiktok", 17, 1_140_000, 0.069, 0.0038, 0.007],
];

const handleFor = (creatorId: string, platform: "instagram" | "tiktok") => {
  const cr = sampleCreators.find((x) => x.id === creatorId)!;
  return (platform === "instagram" ? cr.instagram : cr.tiktok) ?? "creator";
};

export const samplePosts: Post[] = seeds.map(([id, campaignId, creatorId, platform, ago, views, lr, cr, sr], i) => ({
  id,
  campaignId,
  creatorId,
  platform,
  url:
    platform === "tiktok"
      ? `https://www.tiktok.com/@${handleFor(creatorId, platform)}/video/73${(4_000_000_000_000_000 + i * 97_531).toString().slice(0, 17)}`
      : `https://www.instagram.com/reel/SAMPLE${id.toUpperCase()}x/`,
  postedAt: daysAgo(ago),
  views,
  likes: Math.round(views * lr),
  comments: Math.round(views * cr),
  shares: Math.round(views * sr),
  lastRefreshed: new Date(today.getTime() - 3 * 3600_000).toISOString(),
  status: "Live",
}));

// Daily snapshots that follow a typical short-form curve: fast early growth, then a long tail.
export const sampleSnapshots: Snapshot[] = samplePosts.flatMap((p) => {
  const ago = seeds.find((s) => s[0] === p.id)![4];
  const out: Snapshot[] = [];
  const total = Math.max(ago, 1);
  const norm = 1 - Math.exp(-total / 2.2);
  for (let d = 0; d <= ago; d++) {
    const share = (1 - Math.exp(-Math.max(d, 0.4) / 2.2)) / norm;
    const f = Math.min(share, 1);
    out.push({
      id: `${p.id}-s${d}`,
      postId: p.id,
      campaignId: p.campaignId,
      capturedAt: `${daysAgo(ago - d)}T11:00:00.000Z`,
      views: Math.round(p.views * f),
      likes: Math.round(p.likes * f),
      comments: Math.round(p.comments * f),
      shares: Math.round(p.shares * f),
    });
  }
  return out;
});

// Roster for each sample campaign: the live campaigns are fully approved; the holiday one is mid-review.
const assign = (campaignId: string, creatorId: string, status: Assignment["status"], extra: Partial<Assignment> = {}): Assignment => ({
  id: `as-${campaignId}-${creatorId}`,
  campaignId,
  creatorId,
  status,
  fee: sampleCreators.find((c) => c.id === creatorId)?.rate,
  ...extra,
});

export const sampleAssignments: Assignment[] = [
  ...sampleCampaigns[0].creatorIds.map((id, i) => assign("cmp01", id, "Approved", i < 2 ? { paid: true } : {})),
  ...sampleCampaigns[1].creatorIds.map((id) => assign("cmp02", id, "Approved")),
  assign("cmp03", "cr09", "Approved", { reviewedBy: "Label team" }),
  assign("cmp03", "cr15", "Approved", { reviewedBy: "Label team" }),
  assign("cmp03", "cr17", "Proposed"),
  assign("cmp03", "cr07", "Proposed"),
  assign("cmp03", "cr10", "Changes requested", {
    partnerComment: "Love the energy, but can we see a softer option for a holiday ballad?",
    reviewedBy: "Label team",
  }),
  assign("cmp03", "cr11", "Declined", { partnerComment: "Audience skews too local for this one.", reviewedBy: "Label team" }),
];

export const sampleDrafts: Draft[] = [
  { id: "dr1", assignmentId: "as-cmp01-cr01", campaignId: "cmp01", creatorId: "cr01", version: 2, status: "Approved", caption: "the drive home hits different", submittedAt: daysAgo(17), reviewedBy: "Label team", platforms: ["TikTok", "Instagram"] },
  { id: "dr2", assignmentId: "as-cmp01-cr03", campaignId: "cmp01", creatorId: "cr03", version: 1, status: "Approved", caption: "back roads season", submittedAt: daysAgo(18), reviewedBy: "Label team" },
  { id: "dr3", assignmentId: "as-cmp01-cr08", campaignId: "cmp01", creatorId: "cr08", version: 1, status: "Approved", caption: "windows down", submittedAt: daysAgo(18), reviewedBy: "Label team" },
  { id: "dr5", assignmentId: "as-cmp03-cr09", campaignId: "cmp03", creatorId: "cr09", version: 1, status: "Approved", caption: "holiday mode", submittedAt: daysAgo(3), reviewedAt: daysAgo(2), reviewedBy: "Label team" },
  { id: "dr4", assignmentId: "as-cmp01-cr13", campaignId: "cmp01", creatorId: "cr13", version: 2, status: "Changes requested", caption: "leg day soundtrack", submittedAt: daysAgo(19), partnerComment: "Can the song start in the first two seconds?", reviewedBy: "Label team", platforms: ["TikTok"] },
];
