import { CreatorBrowser } from "@/components/CreatorBrowser";
import { CreatorImport } from "@/components/CreatorImport";
import { Header } from "@/components/Header";
import { isSampleMode } from "@/lib/config";
import { getCreators } from "@/lib/data";

export const revalidate = 300;

export default async function CreatorsPage() {
  const creators = await getCreators();

  return (
    <>
      <Header active="creators" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h1 className="headline text-7xl max-sm:text-5xl">Creators</h1>
          {!isSampleMode() && <CreatorImport />}
        </div>
        <p className="mt-4 max-w-prose">
          Every influencer we work with, tagged and filterable. Tag creators right here: click + Tag on a row, or tick
          several and add a tag to all of them. Edit everything else in Airtable; changes show here within five minutes.
        </p>
        <CreatorBrowser creators={creators} editable={!isSampleMode()} />
      </main>
    </>
  );
}
