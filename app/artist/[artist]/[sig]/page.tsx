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
  // Campaigns awaiting approval (or canceled) with nothing posted aren't results yet.
  const campaigns = a.campaigns.filter((c) => c.posts > 0 || (c.status !== "Awaiting approval" && c.status !== "Canceled"));

  return (
    <main className="app public-page">
      {/* Brand rule: the red logo anchors the top-left with clear space around it. */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-6 py-2">
        <Logo />
        <a href={REQUEST_FORM_URL} target="_blank" rel="noreferrer" className="btn btn-primary">
          Request a campaign
        </a>
      </header>

      <section className="card hero px-8 py-8 max-sm:px-5 max-sm:py-6">
        <p className="tile-label">Creator campaign results</p>
        <h1 className="headline mt-1 text-5xl max-sm:text-3xl">{row.name}</h1>
        <p className="tile-value mt-8 text-[72px] leading-none max-sm:text-5xl text-fb-red">{compact(t.stats.views)}</p>
        <p className="mt-2 text-[15px] text-secondary">total views</p>
      </section>
      {/* Outside the hero card: inside it, every tile would take the hero's large red number style. */}
      <div className="mt-3.5">
        <HeroStats
          items={[
            { label: "Posts", value: compact(t.posts) },
            { label: "Campaigns", value: String(campaigns.length) },
            { label: "Engagements", value: compact(engagements) },
            { label: "Engagement rate", value: t.stats.views ? pct(t.engagementRate) : "—" },
          ]}
        />
      </div>

      <h2 className="section-title">Campaigns</h2>
      <section className="card" aria-label="Campaigns">
        {campaigns.length === 0 ? (
          <p className="empty">Results will show here once the first campaign goes live.</p>
        ) : (
          <ul className="-mx-2">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_0.6fr_0.4fr] items-center gap-x-8 gap-y-1 rounded-control border-b border-line px-2 py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <h3 className="font-display text-[15px] font-bold tracking-[0.02em]">{c.name}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {[c.status === "Live" || c.status === "Complete" ? c.status : "", dateRange(c.startDate)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <div className="text-right md:text-left">
                  <p className="tile-label">views</p>
                  <p className="tile-value text-fb-red">{c.stats.views ? compact(c.stats.views) : "—"}</p>
                </div>
                <div className="max-md:hidden">
                  <p className="tile-label">posts</p>
                  <p className="tile-value text-[22px]">{c.posts}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="mt-10 border-t border-line pt-5 text-xs text-muted">
        Live stats refresh daily from public post data and can lag the apps by up to 24 hours.
      </footer>
    </main>
  );
}
