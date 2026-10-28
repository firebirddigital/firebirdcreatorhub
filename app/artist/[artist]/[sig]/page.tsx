import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HeroStats } from "@/components/campaign/Shell";
import { Logo } from "@/components/Logo";
import { getAnalytics, normalize } from "@/lib/analytics";
import { isValidArtistShare } from "@/lib/auth";
import { REQUEST_FORM_URL } from "@/lib/config";
import { compact, dateRange, pct } from "@/lib/format";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ artist: string; sig: string }> }): Promise<Metadata> {
  const { artist, sig } = await params;
  const key = normalize(decodeURIComponent(artist));
  const name =
    key && (await isValidArtistShare(key, sig))
      ? (await getAnalytics({ artist: key })).byArtist.find((r) => normalize(r.name) === key)?.name
      : undefined;
  if (!name) return { robots: { index: false, follow: false } };
  const title = `${name}: creator campaign results`;
  return { title, openGraph: { title, siteName: "Firebird" }, twitter: { card: "summary_large_image", title }, robots: { index: false, follow: false } };
}

// Shareable results for one artist: totals across their campaigns. No posts, creators, fees or CPM.
export default async function ArtistResultsPage({ params }: { params: Promise<{ artist: string; sig: string }> }) {
  const { artist, sig } = await params;
  const key = normalize(decodeURIComponent(artist));
  if (!key || !(await isValidArtistShare(key, sig))) notFound();

  const a = await getAnalytics({ artist: key });
  const row = a.byArtist.find((r) => normalize(r.name) === key);
  if (!row) notFound();
  const t = a.totals;
  const engagements = t.stats.likes + t.stats.comments + t.stats.shares;
  // Campaigns still in planning with nothing posted aren't results yet.
  const campaigns = a.campaigns.filter((c) => c.posts > 0 || c.status !== "Planning");

  return (
    <>
      <header className="bg-fb-black px-[57px] max-sm:px-6 pt-[57px] max-sm:pt-8 flex flex-wrap items-start justify-between gap-6">
        <Logo variant="white" />
        <a
          href={REQUEST_FORM_URL}
          target="_blank"
          rel="noreferrer"
          className="subtitle border-2 border-fb-white px-5 py-2.5 text-sm text-fb-white hover:bg-fb-white hover:text-fb-black transition-colors"
        >
          Request a campaign
        </a>
      </header>
      <main className="pb-24">
        <section className="bg-fb-black text-fb-white px-[57px] max-sm:px-6 py-14">
          <p className="subtitle text-lg">Creator campaign results</p>
          <h1 className="headline mt-2 text-6xl max-sm:text-4xl">{row.name}</h1>
          <p className="figure mt-10 text-8xl max-sm:text-6xl text-fb-red">{compact(t.stats.views)}</p>
          <p className="mt-2 text-lg">total views</p>
          <HeroStats
            items={[
              { label: "Posts", value: compact(t.posts) },
              { label: "Campaigns", value: String(campaigns.length) },
              { label: "Engagements", value: compact(engagements) },
              { label: "Engagement rate", value: t.stats.views ? pct(t.engagementRate) : "—" },
            ]}
          />
        </section>

        <section className="px-[57px] max-sm:px-6 pt-12">
          <h2 className="headline text-3xl">Campaigns</h2>
          {campaigns.length === 0 ? (
            <p className="mt-4">Results will show here once the first campaign goes live.</p>
          ) : (
            <ul className="mt-6 border-t-2 border-fb-black">
              {campaigns.map((c) => (
                <li
                  key={c.id}
                  className="grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_0.6fr_0.4fr] items-center gap-x-8 gap-y-1 border-b border-fb-black/20 py-5"
                >
                  <div>
                    <h3 className="subtitle text-xl">{c.name}</h3>
                    <p className="mt-1 text-sm">
                      {[c.status === "Live" ? "Live" : c.status === "Wrapped" ? "Wrapped" : "", dateRange(c.startDate)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <p className="text-right md:text-left">
                    <span className="figure text-4xl text-fb-red">{c.stats.views ? compact(c.stats.views) : "—"}</span>
                    <span className="block text-sm">views</span>
                  </p>
                  <p className="max-md:hidden">
                    <span className="figure text-2xl">{c.posts}</span>
                    <span className="block text-sm">posts</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer className="px-[57px] max-sm:px-6 pb-14 text-sm">
        Live stats refresh daily from public post data and can lag the apps by up to 24 hours.
      </footer>
    </>
  );
}
