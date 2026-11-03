import { CreatorBrowser } from "@/components/CreatorBrowser";
import { CreatorImport } from "@/components/CreatorImport";
import { TeamShell } from "@/components/Header";
import { PageHead } from "@/components/nest/Rail";
import { isSampleMode } from "@/lib/config";
import { CopyButton } from "@/components/campaign/TeamControls";
import { rosterSignature } from "@/lib/auth";
import { getCreators, getTrackRecords } from "@/lib/data";
import { siteOrigin } from "@/lib/origin";

export const revalidate = 300;

export default async function CreatorsPage() {
  const [creators, trackRecords, origin, sig, ratesSig] = await Promise.all([
    getCreators(),
    getTrackRecords(),
    siteOrigin(),
    rosterSignature(),
    rosterSignature({ rates: true }),
  ]);
  const rosterUrl = `${origin}/roster/${sig}`;
  const rosterRatesUrl = `${origin}/roster/${ratesSig}`;

  return (
    <TeamShell active="creators">
      <PageHead title="Creators">
        <a href="/creators/preview" className="btn">
          Preview shareable page
        </a>
        <CopyButton text={rosterUrl} label="Copy shareable link" copiedLabel="Link copied" variant="button" />
        <CopyButton text={rosterRatesUrl} label="Copy link with rates" copiedLabel="Link with rates copied" variant="button" />
        {!isSampleMode() && <CreatorImport />}
      </PageHead>
      <p className="banner mt-3.5 max-w-prose">
        The shareable link shows partners this list with a Request a campaign button, and lets them build their own
        shortlists. It never shows emails, notes or track records. Rates and spend totals only appear on the link with
        rates; send that one only to partners you&apos;re happy to show pricing to.
      </p>
      <p className="max-w-prose text-sm text-secondary">
        Every influencer we work with, tagged and filterable. Tag creators right here: click + Tag on a row, or tick
        several and add a tag to all of them. Edit everything else in Airtable; changes show here within five minutes.
      </p>
      <CreatorBrowser creators={creators} trackRecords={trackRecords} editable={!isSampleMode()} />
    </TeamShell>
  );
}
