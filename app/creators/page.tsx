import { CreatorBrowser } from "@/components/CreatorBrowser";
import { Header } from "@/components/Header";
import { getCreators } from "@/lib/data";

export const revalidate = 300;

export default async function CreatorsPage() {
  const creators = await getCreators();

  return (
    <>
      <Header active="creators" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <h1 className="headline text-7xl max-sm:text-5xl">Creators</h1>
        <p className="mt-4 max-w-prose">
          Filter the roster by niche, platform and reach. Edit creators in Airtable; changes show here within five
          minutes.
        </p>
        <CreatorBrowser creators={creators} />
      </main>
    </>
  );
}
