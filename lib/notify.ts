// Email notifications, sent from the team's connected Gmail (see gmail.ts) or, failing that, Resend.
// Does nothing until one of them is set up, so the hub works the same without it.
//   RESEND_API_KEY      Resend API key
//   NOTIFY_FROM         Sender on a domain verified in Resend, e.g. "Firebird Creator Hub <hub@firebird-music.com>"
//   TEAM_NOTIFY_EMAILS  Comma-separated team addresses that get every update
import { shareSignature, submitSignature } from "./auth";
import { campaignStage, getAssignment, getAssignments, getCampaign, getCampaignView, getCreators, getDrafts } from "./data";
import { compact, pct } from "./format";
import { gmailSender, sendViaGmail } from "./gmail";
import type { Campaign } from "./types";

const resendEnabled = () => Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM);
const enabled = async () => Boolean(await gmailSender()) || resendEnabled();
/** Whether the hub can send email yet: Gmail connected, or the Resend key and sender set. */
export const emailEnabled = enabled;

export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
/** Every email address in free text, such as Partner Contacts ("Jane Doe <jane@label.com>", one per line). */
export const emailsIn = (text?: string) => [...new Set((text ?? "").match(/[^\s<>(),;"']+@[^\s<>(),;"']+\.[^\s<>(),;"']+/g) ?? [])].filter(isEmail);
const teamEmails = () =>
  (process.env.TEAM_NOTIFY_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Brand-plain email: red caps headline, Lato/Arial body, one red button. */
function html(opts: { headline: string; lines: string[]; button?: { label: string; url: string }; quote?: string }) {
  return `<!doctype html><html><body style="margin:0;background:#ffffff;font-family:Lato,Arial,sans-serif;color:#000005">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<p style="margin:0 0 32px;font-family:Montserrat,Arial,sans-serif;font-weight:800;color:#ED2124;font-size:20px">Firebird</p>
<h1 style="margin:0 0 16px;font-family:Montserrat,Arial,sans-serif;font-weight:800;color:#ED2124;font-size:26px;text-transform:uppercase;line-height:1.1">${esc(opts.headline)}</h1>
${opts.lines.map((l) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5">${esc(l)}</p>`).join("")}
${opts.quote ? `<blockquote style="margin:16px 0;padding:0 0 0 12px;border-left:4px solid #ED2124;font-size:16px;line-height:1.5">${esc(opts.quote)}</blockquote>` : ""}
${opts.button ? `<p style="margin:24px 0 0"><a href="${esc(opts.button.url)}" style="display:inline-block;background:#ED2124;color:#ffffff;text-decoration:none;font-family:Montserrat,Arial,sans-serif;font-weight:700;text-transform:uppercase;font-size:13px;padding:14px 22px">${esc(opts.button.label)}</a></p>` : ""}
</div></body></html>`;
}

async function send(to: string[], subject: string, body: Parameters<typeof html>[0]): Promise<string | undefined> {
  const recipients = [...new Set(to.map((t) => t.toLowerCase()))];
  if (!recipients.length) return;
  const text = [body.headline, ...body.lines, body.quote ?? "", body.button ? `${body.button.label}: ${body.button.url}` : ""]
    .filter(Boolean)
    .join("\n\n");
  if (await gmailSender()) {
    // Gmail: one message per person, so nobody sees the others' addresses.
    const errors = [];
    for (const r of recipients) {
      const error = await sendViaGmail(r, subject, html(body), text);
      if (error) errors.push(error);
    }
    if (errors.length) console.error(errors[0]);
    return errors[0];
  }
  if (!resendEnabled()) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM,
      to: recipients,
      subject,
      html: html(body),
      text,
    }),
  });
  if (!res.ok) {
    const error = `Resend email failed (${res.status}): ${await res.text()}`;
    console.error(error);
    return error;
  }
}

const songLine = (c: Campaign) => `${c.artist}${c.song ? `, “${c.song}”` : ""}`;

/** Emails of partners who've reviewed anything on this campaign (from "Name <email>" in Reviewed By). */
async function partnerEmails(campaignId: string): Promise<string[]> {
  const [roster, drafts] = await Promise.all([getAssignments(campaignId, { fresh: true }), getDrafts(campaignId, { fresh: true })]);
  return [...roster.map((a) => a.reviewedBy), ...drafts.map((d) => d.reviewedBy)]
    .map((r) => r?.match(/<([^>]+@[^>]+)>/)?.[1])
    .filter((e): e is string => Boolean(e));
}

/** A new draft is waiting: tell the team and any partner who has reviewed on this campaign. */
export async function notifyDraftSubmitted(opts: { origin: string; campaignId: string; assignmentId: string; version: number; byTeam?: boolean }) {
  if (!(await enabled())) return;
  const [campaign, assignment, creators] = await Promise.all([getCampaign(opts.campaignId), getAssignment(opts.assignmentId), getCreators()]);
  if (!campaign) return;
  const name = creators.find((c) => c.id === assignment?.creatorId)?.name ?? "A creator";
  const subject = `${name} sent version ${opts.version} for ${campaign.name}`;
  const lines = [
    `${name}'s draft (version ${opts.version}) for ${songLine(campaign)} is ready for review${opts.byTeam ? ", added by the Firebird team" : ""}.`,
  ];
  await send(teamEmails(), subject, {
    headline: "Draft ready",
    lines,
    button: { label: "Open the drafts", url: `${opts.origin}/campaigns/${campaign.id}?tab=drafts` },
  });
  if (campaign.sharingEnabled) {
    const sig = await shareSignature(campaign.id);
    await send(await partnerEmails(campaign.id), subject, {
      headline: "Draft ready for you",
      lines: [...lines, "Watch it and approve or request changes on your link."],
      button: { label: "Review the draft", url: `${opts.origin}/share/${campaign.id}/${sig}?tab=drafts` },
    });
  }
}

/** A partner decided on a creator or draft: tell the team; for draft changes, tell the creator too. */
export async function notifyReview(opts: {
  origin: string;
  campaignId: string;
  kind: "creator" | "draft";
  recordId: string;
  decision: "approve" | "changes" | "decline";
  comment?: string;
  reviewer: string;
}) {
  if (!(await enabled())) return;
  const [campaign, creators] = await Promise.all([getCampaign(opts.campaignId), getCreators()]);
  if (!campaign) return;
  const drafts = opts.kind === "draft" ? await getDrafts(opts.campaignId, { fresh: true }) : [];
  const draft = drafts.find((d) => d.id === opts.recordId);
  const assignmentId = opts.kind === "creator" ? opts.recordId : draft?.assignmentId;
  const assignment = assignmentId ? await getAssignment(assignmentId) : undefined;
  const creator = creators.find((c) => c.id === assignment?.creatorId);
  const name = creator?.name ?? "A creator";
  const what = opts.kind === "creator" ? name : `${name}'s draft${draft ? ` (version ${draft.version})` : ""}`;
  const verb = opts.decision === "approve" ? "approved" : opts.decision === "changes" ? "requested changes on" : "passed on";
  const who = opts.reviewer.replace(/\s*<[^>]*>\s*$/, "");

  await send(teamEmails(), `${who} ${verb} ${what} (${campaign.name})`, {
    headline: opts.decision === "approve" ? "Approved" : opts.decision === "changes" ? "Changes requested" : "Passed",
    lines: [`${who} ${verb} ${what} on ${songLine(campaign)}.`],
    quote: opts.comment?.trim() || undefined,
    button: { label: "Open the campaign", url: `${opts.origin}/campaigns/${campaign.id}?tab=${opts.kind === "creator" ? "creators" : "drafts"}` },
  });

  // The creator only hears about notes on their draft, with a link to send the next version.
  if (opts.kind === "draft" && opts.decision === "changes" && creator?.email && assignmentId) {
    const sig = await submitSignature(assignmentId);
    await send([creator.email], `Notes on your draft for ${songLine(campaign)}`, {
      headline: "A few changes, please",
      lines: [`Hi ${creator.name.split(" ")[0]}, the team left notes on your draft for ${songLine(campaign)}.`],
      quote: opts.comment?.trim() || undefined,
      button: { label: "See notes and send a new version", url: `${opts.origin}/submit/${assignmentId}/${sig}` },
    });
  }
}

/**
 * The campaign's dashboard, emailed to partners: where it stands, the headline numbers (no money) and
 * their share link. Each recipient gets their own email, so addresses aren't shared.
 */
export async function sendDashboardEmail(opts: { origin: string; campaign: Campaign; to: string[]; note?: string }) {
  const { subject, body } = await dashboardEmail(opts);
  const errors: string[] = [];
  for (const to of [...new Set(opts.to.map((e) => e.toLowerCase()))]) {
    const error = await send([to], subject, body);
    if (error) errors.push(`${to}: ${error}`);
  }
  return { sent: opts.to.length - errors.length, errors };
}

/** The dashboard email as partners will see it, for the team's preview. */
export async function previewDashboardEmail(opts: { origin: string; campaign: Campaign; note?: string }) {
  const { subject, body } = await dashboardEmail(opts);
  return { subject, html: html(body) };
}

async function dashboardEmail(opts: { origin: string; campaign: Campaign; note?: string }) {
  const { campaign } = opts;
  const sig = await shareSignature(campaign.id);
  const stage = campaignStage(campaign);
  const url = `${opts.origin}/share/${campaign.id}/${sig}?tab=${stage}`;
  const lines: string[] = [];
  let headline = "Your campaign update";

  if (stage === "live") {
    const view = await getCampaignView(campaign);
    const t = view.totals;
    headline = t.posts ? `${compact(t.views)} views so far` : "Your campaign is live";
    lines.push(
      t.posts
        ? `${songLine(campaign)}: ${compact(t.views)} views across ${t.posts} ${t.posts === 1 ? "post" : "posts"} from ${t.creators} ${t.creators === 1 ? "creator" : "creators"}, with ${pct(t.engagementRate)} engagement.`
        : `${songLine(campaign)} is live. Posts and views show up on your dashboard as they go up.`,
    );
  } else if (stage === "drafts") {
    const drafts = await getDrafts(campaign.id, { fresh: true });
    const waiting = drafts.filter((d) => d.status === "Pending review").length;
    headline = waiting ? "Drafts ready for you" : "Drafts in progress";
    lines.push(
      waiting
        ? `${waiting} ${waiting === 1 ? "draft is" : "drafts are"} waiting for your review for ${songLine(campaign)}.`
        : `Creators are working on drafts for ${songLine(campaign)}. You can watch each one as it comes in.`,
    );
  } else {
    const roster = await getAssignments(campaign.id, { fresh: true });
    const proposed = roster.filter((a) => a.status === "Proposed").length;
    headline = proposed ? "Creators ready for you" : "Your creator lineup";
    lines.push(
      proposed
        ? `We've proposed ${proposed} ${proposed === 1 ? "creator" : "creators"} for ${songLine(campaign)}. Approve the ones you like or ask for changes.`
        : `Here's the creator lineup for ${songLine(campaign)}.`,
    );
  }
  lines.push("Your dashboard updates daily. No login needed.");

  const subject = `${campaign.name}: ${headline.replace(/^Your c/, "C")}`;
  return {
    subject,
    body: { headline, lines, quote: opts.note?.trim() || undefined, button: { label: "Open your dashboard", url } },
  };
}
