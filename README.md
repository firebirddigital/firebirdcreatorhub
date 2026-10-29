# Firebird Creator Hub

A Firebird-branded site for influencer campaigns:

- **Creators**: the roster with niche tags (Fitness, Sports, Country…), platform and follower filters, search, and a CSV download of whatever you've filtered.
- **Campaigns**: one dashboard per campaign. Paste live Instagram and TikTok links, and views, likes, comments and shares pull in automatically. Totals, views over time, top creators and every post playing in place.
- **Three stages per campaign**: Creators (who we plan to use, with followers and average views), Drafts (videos for approval) and Live (results).
- **Partner share links**: one private link per campaign for labels and artist teams. It moves through the three stages, and partners approve creators and drafts right on it. It never shows budget, cost per view, contact details or notes, and only shows fees when you tick Show Rates.
- **Creator upload links**: each approved creator gets a private page with the brief, the team's notes and an upload form for their draft.

Airtable is the database. Apify pulls the public post stats. The site runs on Next.js and Vercel.

It runs on sample data until you add your keys, so you can see it working first.

---

## 1. Run it on your machine

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. You'll see a black bar saying you're on sample data.

**Logo:** download "Firebird logotype RED.png" and "Firebird logotype WHITE.png" from the Firebird and Portco Branding Drive folder and save them in `public/brand/` as `firebird-logotype-red.png` and `firebird-logotype-white.png`.

---

## 2. Set up Airtable

Create a base with these four tables. Names must match exactly (or change them in `lib/config.ts`).

### Creators

| Field | Type |
|---|---|
| Name | Single line text (primary) |
| Photo | Attachment |
| Instagram Handle | Single line text (no @ needed) |
| TikTok Handle | Single line text |
| Instagram Followers | Number |
| TikTok Followers | Number |
| Tags | Multiple select (Fitness, Sports, Country, Comedy…) |
| Location | Single line text |
| Rate | Currency |
| Email | Email |
| Notes | Long text |

### Campaigns

| Field | Type |
|---|---|
| Name | Single line text (primary) |
| Artist | Single line text |
| Song | Single line text |
| Start Date | Date |
| End Date | Date |
| Budget | Currency |
| Status | Single select: Planning, Live, Wrapped |
| Creators | Link to Creators |
| Sharing Enabled | Checkbox (tick to allow a client share link) |

### Posts

| Field | Type |
|---|---|
| Post URL | URL (primary) |
| Platform | Single select: Instagram, TikTok |
| Creator | Link to Creators |
| Campaign | Link to Campaigns |
| Posted Date | Date |
| Views | Number |
| Likes | Number |
| Comments | Number |
| Shares | Number |
| Last Refreshed | Date (include time) |
| Refresh Note | Single line text |
| Status | Single select: Live, Removed |

Set a post to **Removed** to drop it from the totals without deleting it.

### Campaigns: extra fields for the three stages

| Field | Type |
|---|---|
| Stage | Single select: Creators, Drafts, Live (which tab the share link opens on) |
| Brief | Long text (shown to creators on their upload page) |
| Show Rates | Checkbox (show creator fees on the partner link) |

Creators also has **Avg Views** (number) and **Stats Updated** (date with time), filled by "Refresh creator stats".

### Campaign Creators

One row per creator per campaign. The hub writes these when you add creators to a campaign.

| Field | Type |
|---|---|
| Label | Single line text (primary) |
| Campaign | Link to Campaigns |
| Creator | Link to Creators |
| Status | Single select: Proposed, Approved, Changes requested, Declined |
| Fee | Currency |
| Partner Comment | Long text |
| Reviewed By | Single line text |
| Reviewed At | Date (include time) |
| Campaign Record ID | Single line text |

### Drafts

Written by the creator upload page.

| Field | Type |
|---|---|
| Label | Single line text (primary) |
| Campaign Creator | Link to Campaign Creators |
| Campaign | Link to Campaigns |
| Creator | Link to Creators |
| Video URL | URL |
| Caption | Long text |
| Version | Number |
| Status | Single select: Pending review, Approved, Changes requested |
| Partner Comment | Long text |
| Reviewed By | Single line text |
| Submitted At | Date (include time) |
| Reviewed At | Date (include time) |
| Campaign Record ID | Single line text |

### Snapshots

The refresh job writes one row per post each time it runs. That history powers the views-over-time chart. Nobody needs to edit this table.

| Field | Type |
|---|---|
| Post | Link to Posts |
| Campaign | Link to Campaigns |
| Campaign Record ID | Single line text |
| Captured At | Date (include time) |
| Views | Number |
| Likes | Number |
| Comments | Number |
| Shares | Number |

### Token

Create a personal access token at https://airtable.com/create/tokens with scopes `data.records:read` and `data.records:write`, and give it access to this base. The base ID is the `app…` part of the base URL.

---

## 3. Set up Apify (the stats)

1. Sign up at https://apify.com and copy your API token from Settings → Integrations.
2. That's it. The app uses `apify~instagram-scraper` and `clockworks~tiktok-scraper` by default. To use a different actor, set `APIFY_INSTAGRAM_ACTOR` or `APIFY_TIKTOK_ACTOR`. The field mapping in `lib/apify.ts` covers the common naming.

Each refresh costs a fraction of a cent per post. Check current pricing on the actor pages.

**Worth knowing:** scraping runs against Instagram's and TikTok's terms, and it can break when they change their sites. Posts with hidden like counts may come back without likes. For Instagram, the official route is Meta's Business Discovery API, which needs a Meta developer app and App Review. It's a good next step once this is proven.

---

## 3b. Set up video uploads (Vercel Blob)

Draft videos are stored in Vercel Blob. After your first deploy:

1. In Vercel, open the project → **Storage** → **Create** → **Blob**, and connect it to the project. Vercel adds `BLOB_READ_WRITE_TOKEN` for you.
2. To test uploads locally too, run `npx vercel env pull .env.local` (this rewrites `.env.local` with Vercel's values, so check your other keys are in Vercel first).

Uploaded files are public to anyone who has the exact (random) file address, which only appears on the partner link and the creator's own page.

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill it in:

| Variable | What it is |
|---|---|
| `AIRTABLE_TOKEN` | Airtable personal access token |
| `AIRTABLE_BASE_ID` | Base ID, starts with `app` |
| `APIFY_TOKEN` | Apify API token |
| `TEAM_PASSWORD` | The shared team password. Leave blank only for local testing. |
| `AUTH_SECRET` | Any long random string. Changing it signs everyone out and kills every share link. |
| `CRON_SECRET` | Any long random string. Vercel sends it to the daily refresh. |

Generate random strings with `openssl rand -hex 32`.

---

## 5. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, **Add New → Project**, import the repo, and add the environment variables above.
3. Deploy.

The daily stats refresh is set in `vercel.json` to run at 11:00 UTC (6am Nashville in winter). The Hobby plan allows one cron run per day; Pro allows more often. You can also hit **Refresh stats now** on any campaign.

---

## How the team uses it

1. **Set up:** create the campaign in Airtable with its Brief, set Stage to Creators and tick Sharing Enabled.
2. **Creators:** on the campaign's Creators tab, search the roster and add creators (they start as Proposed). Click **Refresh creator stats** to pull followers and average views. Send the partner link with **Copy partner share link**. Partners approve, request changes or pass on each creator.
3. **Drafts:** click **Move campaign to Drafts**. For each approved creator, **Copy draft upload link** and send it to them. Their videos appear on the Drafts tab, and partners approve or send notes. Creators see the notes on their page and upload a new version.
4. **Live:** click **Move campaign to Live**. Paste each live link into **Add a live post**. Creators are detected from the post, and stats refresh every morning.
5. The partner keeps the same link the whole way through. Untick Sharing Enabled to switch it off.

---

## Where things live

| Path | What it does |
|---|---|
| `app/creators` | Creator browser |
| `app/campaigns` | Campaign list and dashboards |
| `app/share/[id]/[sig]` | Partner share view with approvals (strips internal data) |
| `app/submit/[aid]/[sig]` | Creator draft upload page |
| `components/campaign` | The three stage tabs and their controls |
| `lib/roster.ts` | Roster, approvals, drafts and creator stats writes |
| `app/api/refresh` | Pulls fresh stats (cron and the refresh button) |
| `app/api/posts` | Adds a post from the dashboard |
| `lib/config.ts` | Airtable table and field names |
| `lib/apify.ts` | Scraper calls and stat mapping |
| `lib/sample-data.ts` | The fictional sample data |
| `middleware.ts` | Team login gate |
