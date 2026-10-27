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
    <main className="min-h-dvh">
      <header className="bg-fb-black text-fb-white px-[57px] max-sm:px-6 pt-[57px] max-sm:pt-8 pb-14">
        <Logo variant="white" />
        <p className="subtitle mt-16 text-lg">
          {campaign.artist}
          {campaign.song ? `, “${campaign.song}”` : ""}
        </p>
        <h1 className="headline mt-2 text-6xl max-sm:text-4xl">{headline}</h1>
        <p className="mt-4 max-w-prose text-lg text-fb-white/85">
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

      <div className="px-[57px] max-sm:px-6 py-14 grid gap-14 lg:grid-cols-[1fr_1fr] max-w-6xl">
        <section>
          {latest?.status === "Changes requested" && latest.partnerComment && (
            <div className="mb-10">
              <h2 className="headline text-3xl">What to change</h2>
              <blockquote className="mt-4 border-l-4 border-fb-red pl-4 text-lg">{latest.partnerComment}</blockquote>
            </div>
          )}
          <h2 className="headline text-3xl">The brief</h2>
          <p className="mt-4 whitespace-pre-line max-w-prose">
            {campaign.brief ?? "Your Firebird contact will send the brief separately."}
          </p>

          {mine.length > 0 && (
            <>
              <h2 className="headline mt-12 text-3xl">Your versions</h2>
              <ol className="mt-4 border-t-2 border-fb-black">
                {mine.map((d) => (
                  <li key={d.id} className="border-b border-fb-black/20 py-3">
                    <p>
                      <span className="font-bold">Version {d.version}</span>, sent {shortDate(d.submittedAt)}.{" "}
                      {d.status === "Pending review" ? "Waiting for review." : d.status === "Approved" ? "Approved." : "Changes requested."}
                    </p>
                    {d.partnerComment && d !== latest && <p className="mt-1 text-sm">{d.partnerComment}</p>}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <section>
          {latest?.status === "Approved" ? (
            <div className="border-2 border-fb-black p-6">
              <p className="font-bold">Nothing more to upload.</p>
              <p className="mt-2 text-sm">
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
