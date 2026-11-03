import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DraftUploader } from "@/components/DraftUploader";
import { Logo } from "@/components/Logo";
import { isValidSubmit } from "@/lib/auth";
import { isSampleMode } from "@/lib/config";
import { getAssignment, getCampaign, getCreators, getDrafts } from "@/lib/data";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Upload your draft", robots: { index: false, follow: false } };

// A creator's private page: the brief, their past versions with feedback, and the upload form.
export default async function SubmitPage({ params }: { params: Promise<{ aid: string; sig: string }> }) {
  const { aid, sig } = await params;
  if (!(await isValidSubmit(aid, sig))) notFound();
  const assignment = await getAssignment(aid);
  if (!assignment || assignment.status === "Declined") notFound();

  const [campaign, drafts, creators] = await Promise.all([
    getCampaign(assignment.campaignId),
    getDrafts(assignment.campaignId, { fresh: true }),
    getCreators(),
  ]);
  if (!campaign) notFound();
  const creator = creators.find((c) => c.id === assignment.creatorId);
  const mine = drafts.filter((d) => d.assignmentId === aid).sort((a, b) => b.version - a.version);
  const latest = mine[0];
  const firstName = creator?.name.split(" ")[0];

  const headline = !latest
    ? "Upload your draft"
    : latest.status === "Approved"
      ? "You're approved to post"
      : latest.status === "Changes requested"
        ? "A few changes, please"
        : "Draft received";

  return (
    <main className="app public-page">
      <header>
        <Logo />
        <p className="subtitle mt-12 max-sm:mt-8 text-[13px] tracking-[0.06em] text-muted">
          {campaign.artist}
          {campaign.song ? `, “${campaign.song}”` : ""}
        </p>
        <h1 className="headline mt-2 text-4xl max-sm:text-3xl">{headline}</h1>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-secondary">
          {!latest &&
            `${firstName ? `Hi ${firstName}. ` : ""}Read the brief, then send your draft here: paste a share link or upload the file. The team will review it and you'll see their notes on this page.`}
          {latest?.status === "Pending review" &&
            `Thanks${firstName ? `, ${firstName}` : ""}. Version ${latest.version} is with the team for review. Check back here for notes.`}
          {latest?.status === "Changes requested" &&
            "The team left notes on your last version. Make the changes and send a new version below."}
          {latest?.status === "Approved" &&
            "Your draft is approved. Post it on the agreed date, then send the live link to your Firebird contact."}
        </p>
      </header>

      <div className="mt-8 grid gap-3.5 items-start lg:grid-cols-2">
        <section className="flex flex-col gap-3.5">
          {latest?.status === "Changes requested" && latest.partnerComment && (
            <div className="card hero">
              <h2>What to change</h2>
              <blockquote className="mt-3 border-l-[3px] border-fb-red pl-3 text-[15px] leading-relaxed">
                {latest.partnerComment}
              </blockquote>
            </div>
          )}
          <div className="card">
            <h2>The brief</h2>
            <p className="mt-3 whitespace-pre-line max-w-prose leading-relaxed">
              {campaign.brief ?? "Your Firebird contact will send the brief separately."}
            </p>
          </div>

          {mine.length > 0 && (
            <div className="card">
              <h2>Your versions</h2>
              <ol className="mt-2">
                {mine.map((d) => (
                  <li key={d.id} className="border-b border-line py-3 last:border-b-0 last:pb-0">
                    <p>
                      <span className="font-bold">Version {d.version}</span>, sent {shortDate(d.submittedAt)}.{" "}
                      {d.status === "Pending review" ? "Waiting for review." : d.status === "Approved" ? "Approved." : "Changes requested."}
                    </p>
                    {d.partnerComment && d !== latest && <p className="mt-1 text-sm text-secondary">{d.partnerComment}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>

        <section>
          {latest?.status === "Approved" ? (
            <div className="card">
              <p className="font-bold">Nothing more to upload.</p>
              <p className="mt-2 text-sm text-secondary">
                Need to send an updated cut anyway? Ask your Firebird contact and they&apos;ll reopen it.
              </p>
            </div>
          ) : (
            <DraftUploader
              aid={aid}
              sig={sig}
              nextVersion={(latest?.version ?? 0) + 1}
              disabled={isSampleMode() || latest?.status === "Pending review"}
              disabledReason={
                isSampleMode()
                  ? "Uploads turn on once the hub is connected to Airtable."
                  : "You can upload a new version once the team has reviewed this one."
              }
            />
          )}
        </section>
      </div>
    </main>
  );
}
