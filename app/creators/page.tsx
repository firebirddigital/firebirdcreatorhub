import { CreatorBrowser } from "@/components/CreatorBrowser";
import { CreatorImport } from "@/components/CreatorImport";
import { Header } from "@/components/Header";
import { isSampleMode } from "@/lib/config";
import { CopyButton } from "@/components/campaign/TeamControls";
import { rosterSignature } from "@/lib/auth";
import { getCreators, getTrackRecords } from "@/lib/data";
import { siteOrigin } from "@/lib/origin";

export const revalidate = 300;

export default async function CreatorsPage() {
  const [creators, trackRecords, origin, sig] = await Promise.all([getCreators(), getTrackRecords(), siteOrigin(), rosterSignature()]);
  const rosterUrl = `${origin}/roster/${sig}`;

  return (
    <>
      <Header active="creators" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-6">
          <h1 className="headline text-7xl max-sm:text-5xl mr-3">Creators</h1>
          <a
            href="/creators/preview"
            className="ml-auto subtitle border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors"
          >
            Preview shareable page
          </a>
          <CopyButton text={rosterUrl} label="Copy shareable link" copiedLabel="Link copied" variant="button" />
          {!isSampleMode() && <CreatorImport />}
        </div>
        <p className="mt-4 max-w-prose text-sm">
          The shareable link shows partners this list with a Request a campaign button. It never shows emails, notes, rates
          or track records, and can&apos;t be downloaded.
        </p>
        <p className="mt-4 max-w-prose">
          Every influencer we work with, tagged and filterable. Tag creators right here: click + Tag on a row, or tick
          several and add a tag to all of them. Edit everything else in Airtable; changes show here within five minutes.
        </p>
        <CreatorBrowser creators={creators} trackRecords={trackRecords} editable={!isSampleMode()} />
      </main>
    </>
  );
}
