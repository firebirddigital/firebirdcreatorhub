import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { PartnerPeriod, parsePeriod } from "@/components/PartnerPeriod";
import { HeroStats } from "@/components/campaign/Shell";
import { StatusTag } from "@/components/StatusTag";
import { compact, dateRange, money, pct } from "@/lib/format";
import { getPartnerReport, normalize } from "@/lib/partners";

export const dynamic = "force-dynamic";

// Team only: one partner's campaigns and totals.
export default async function PartnerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const period = parsePeriod(sp.period);
  const { partners } = await getPartnerReport(period);
  const p = partners.find((x) => normalize(x.name) === decodeURIComponent(slug));
  if (!p) notFound();

  return (
    <>
      <Header active="partners" />
      <main className="pb-24">
        <section className="bg-fb-black text-fb-white px-[57px] max-sm:px-6 py-14">
          <Link href={`/partners?period=${period}`} className="text-sm underline underline-offset-4">
            All partners
          </Link>
          <p className="subtitle mt-8 text-lg">
            {[p.types.join(", "), p.portfolio ? "Portfolio company" : "Partner"].filter(Boolean).join(" · ")}
          </p>
          <h1 className="headline mt-2 text-6xl max-sm:text-4xl">{p.name}</h1>
          <p className="figure mt-8 text-8xl max-sm:text-6xl text-fb-red">{compact(p.totals.views)}</p>
          <p className="mt-2 text-lg">
            views across {p.campaigns.length} {p.campaigns.length === 1 ? "campaign" : "campaigns"} for {p.campaignArtists.length}{" "}
            {p.campaignArtists.length === 1 ? "artist" : "artists"}
          </p>
          <HeroStats
            items={[
              { label: "Posts", value: String(p.totals.posts) },
              { label: "Engagement rate", value: p.totals.views ? pct(p.engagementRate) : "—" },
              { label: "Spend", value: p.spend ? money(p.spend) : "—", note: "Approved fees" },
              { label: "Current CPM", value: p.currentCpm !== undefined ? money(p.currentCpm, 2) : "—" },
              { label: "Expected CPM", value: p.expected.cpm !== undefined ? money(p.expected.cpm, 2) : "—" },
            ]}
          />
        </section>

        <div className="px-[57px] max-sm:px-6 pt-10 space-y-12">
          <PartnerPeriod period={period} base={`/partners/${slug}`} />

          <section>
            <h2 className="headline text-3xl">Campaigns</h2>
            {p.campaigns.length === 0 ? (
              <p className="mt-4">No campaigns for this partner&apos;s artists in this period.</p>
            ) : (
              <ul className="mt-6 border-t-2 border-fb-black">
                {p.campaigns.map((c) => (
                  <li key={c.id} className="border-b border-fb-black/20">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="group grid grid-cols-[1fr_auto] md:grid-cols-[1.4fr_0.6fr_0.4fr_0.5fr] items-center gap-x-8 gap-y-1 py-5"
                    >
                      <div>
                        <p className="text-sm">{c.artist}</p>
                        <h3 className="subtitle text-xl mt-1 group-hover:text-fb-red transition-colors">{c.name}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                          <StatusTag status={c.status} />
                          <span>{dateRange(c.startDate)}</span>
                        </div>
                      </div>
                      <p className="figure text-4xl text-fb-red text-right md:text-left">{c.views ? compact(c.views) : "—"}</p>
                      <p className="max-md:hidden">
                        <span className="figure text-2xl">{c.posts}</span>
                        <span className="block text-sm">posts</span>
                      </p>
                      <p className="max-md:hidden">
                        <span className="figure text-2xl">{c.spend ? money(c.spend) : "—"}</span>
                        <span className="block text-sm">spend</span>
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="headline text-3xl">Artists</h2>
            <p className="mt-2 text-sm">From IP DB Roster. Artists with campaigns in this period are in bold.</p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {p.rosterArtists.map((a) => (
                <li
                  key={a}
                  className={`px-3 py-1.5 text-sm border-2 ${p.campaignArtists.includes(a) ? "border-fb-black font-bold" : "border-fb-black/30"}`}
                >
                  {a}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}
