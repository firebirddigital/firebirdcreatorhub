// Tells the operations base when a request moves along, through an Airtable automation there
// ("When webhook received" → "Update record"). Off until the webhook URLs are set:
//   REQUEST_WEBHOOK_INFLUENCER   automation on CREATOR CAMPAIGN REQUEST FORM
//   REQUEST_WEBHOOK_SEEDING      automation on Content Seeding Requests
// Server-side only.
import { getRequests, type CampaignRequest, type RequestSource } from "./requests";

export type RequestEvent = "accepted" | "live" | "wrapped";

/** Each form has its own Status options in the operations base. */
const STATUS: Record<RequestSource, Record<RequestEvent, string>> = {
  influencer: { accepted: "In progress", live: "In progress", wrapped: "Done" },
  seeding: { accepted: "Requested", live: "Live", wrapped: "Wrapped" },
};

const webhook = (s: RequestSource) =>
  s === "influencer" ? process.env.REQUEST_WEBHOOK_INFLUENCER : process.env.REQUEST_WEBHOOK_SEEDING;

async function post(request: CampaignRequest, event: RequestEvent, campaignUrl?: string) {
  const url = webhook(request.source);
  if (!url || !request.sourceRecordId || !/^https:\/\/hooks\.airtable\.com\//.test(url)) return;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId: request.sourceRecordId, status: STATUS[request.source][event], campaignUrl: campaignUrl ?? "" }),
  });
  if (!res.ok) console.error(`Request status webhook failed (${res.status})`);
}

/** For one request (right after it's accepted). */
export async function syncRequestStatus(request: CampaignRequest, event: RequestEvent, campaignUrl?: string) {
  await post(request, event, campaignUrl).catch(() => undefined);
}

/** For every request linked to a campaign (when the campaign goes Live or is wrapped). */
export async function syncCampaignRequests(campaignId: string, event: RequestEvent, campaignUrl?: string) {
  if (!process.env.REQUEST_WEBHOOK_INFLUENCER && !process.env.REQUEST_WEBHOOK_SEEDING) return;
  const { requests } = await getRequests({ fresh: true });
  await Promise.all(
    requests.filter((r) => r.hubCampaignIds.includes(campaignId)).map((r) => post(r, event, campaignUrl).catch(() => undefined)),
  );
}
