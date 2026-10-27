// Email notifications through Resend. Server-side only.
// Does nothing until RESEND_API_KEY is set, so the hub works the same without it.
//   RESEND_API_KEY      Resend API key
//   NOTIFY_FROM         Sender on a domain verified in Resend, e.g. "Firebird Creator Hub <hub@firebird-music.com>"
//   TEAM_NOTIFY_EMAILS  Comma-separated team addresses that get every update
import { shareSignature, submitSignature } from "./auth";
import { getAssignment, getAssignments, getCampaign, getCreators, getDrafts } from "./data";
import type { Campaign } from "./types";

const enabled = () => Boolean(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM);
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

async function send(to: string[], subject: string, body: Parameters<typeof html>[0]) {
  const recipients = [...new Set(to.map((t) => t.toLowerCase()))];
  if (!enabled() || !recipients.length) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM,
      to: recipients,
      subject,
      html: html(body),
      text: [body.headline, ...body.lines, body.quote ?? "", body.button ? `${body.button.label}: ${body.button.url}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    }),
  });
  if (!res.ok) console.error(`Resend email failed (${res.status}): ${await res.text()}`);
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
  if (!enabled()) return;
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
  if (!enabled()) return;
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
