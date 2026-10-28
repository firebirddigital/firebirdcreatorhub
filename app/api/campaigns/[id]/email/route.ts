import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { updateRecords } from "@/lib/airtable";
import { CAMPAIGN_FIELDS as CF, TABLES, isSampleMode } from "@/lib/config";
import { getCampaign } from "@/lib/data";
import { emailEnabled, emailsIn, isEmail, previewDashboardEmail, sendDashboardEmail } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";

const MAX_RECIPIENTS = 20;

// Team only. Shows the email exactly as partners would get it (with ?note= for the optional note).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const note = new URL(req.url).searchParams.get("note")?.slice(0, 2000) ?? undefined;
  const { subject, html } = await previewDashboardEmail({ origin: await siteOrigin(), campaign, note });
  const banner = `<div style="font-family:Arial,sans-serif;font-size:13px;background:#000005;color:#fff;padding:10px 16px">Preview. Subject: ${subject.replace(/</g, "&lt;")}</div>`;
  return new NextResponse(html.replace("<body", `<body`).replace(/(<body[^>]*>)/, `$1${banner}`), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// Team only (middleware). Emails the campaign's partner dashboard link to the chosen people, and can
// save new addresses to the campaign's Partner Contacts for next time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (!campaign.sharingEnabled) {
    return NextResponse.json({ error: "Turn on the partner link (Edit campaign) before emailing the dashboard." }, { status: 400 });
  }
  if (!(await emailEnabled())) return NextResponse.json({ error: "Connect Gmail first." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { to?: unknown; note?: unknown; save?: unknown };
  const to = [...new Set((Array.isArray(body.to) ? body.to : []).filter((e): e is string => typeof e === "string").map((e) => e.trim()))];
  if (!to.length) return NextResponse.json({ error: "Pick at least one person." }, { status: 400 });
  if (to.length > MAX_RECIPIENTS) return NextResponse.json({ error: `Send to up to ${MAX_RECIPIENTS} people at a time.` }, { status: 400 });
  const bad = to.filter((e) => !isEmail(e));
  if (bad.length) return NextResponse.json({ error: `Check ${bad.join(", ")}.` }, { status: 400 });
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : undefined;

  // Remember new addresses on the campaign, so they're ticked next time.
  const save = (Array.isArray(body.save) ? body.save : []).filter((e): e is string => typeof e === "string" && isEmail(e.trim()));
  const known = new Set(emailsIn(campaign.partnerContacts).map((e) => e.toLowerCase()));
  const fresh = save.map((e) => e.trim()).filter((e) => !known.has(e.toLowerCase()));
  let saveError: string | undefined;
  if (fresh.length && !isSampleMode()) {
    const contacts = [...(campaign.partnerContacts ?? "").split("\n"), ...fresh].map((l) => l.trim()).filter(Boolean).join("\n");
    try {
      await updateRecords(TABLES.campaigns, [{ id, fields: { [CF.partnerContacts]: contacts } }]);
      revalidateTag("airtable");
    } catch (e) {
      saveError = String(e).includes("UNKNOWN_FIELD_NAME")
        ? "Sent, but couldn't save the new addresses: add a long text field called Partner Contacts to the Campaigns table."
        : "Sent, but couldn't save the new addresses.";
    }
  }

  const result = await sendDashboardEmail({ origin: await siteOrigin(), campaign, to, note });
  if (!result.sent) return NextResponse.json({ error: result.errors[0] ?? "Nothing was sent." }, { status: 502 });
  return NextResponse.json({ ok: true, sent: result.sent, failed: result.errors, saveError });
}
