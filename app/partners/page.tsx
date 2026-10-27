import Link from "next/link";
import { Header } from "@/components/Header";
import { PartnerPeriod, parsePeriod } from "@/components/PartnerPeriod";
import { compact, money, pct } from "@/lib/format";
import { ARTISTS_TABLE, getPartnerReport, partnerSlug, PORTFOLIO_TABLE } from "@/lib/partners";

export const dynamic = "force-dynamic";

// Team only (behind the login): campaign totals for each portfolio company and partner.
export default async function PartnersPage({ searchParams }: { searchParams: Promise<{ period?: string; all?: string }> }) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const showAll = sp.all === "1";
  const { partners, unmatched, missingTables } = await getPartnerReport(period);
  const shown = partners.filter((p) => showAll || p.portfolio);
  const th = "py-3 pr-4 text-left text-xs font-bold whitespace-nowrap";

  return (
    <>
      <Header active="partners" />
      <main className="px-[57px] max-sm:px-6 pb-24">
        <h1 className="headline text-7xl max-sm:text-5xl">Partners</h1>
        <p className="mt-4 max-w-prose">
          Campaign results for each portfolio company, through their artists. A campaign counts toward every partner of its
          artist (management, label, publisher), so totals across partners can overlap.
        </p>

        {missingTables.length > 0 && (
          <p className="mt-6 max-w-prose border-2 border-fb-red p-4 text-sm">
            Sync the operations base&apos;s IP DB Roster and Partners tables into this base as “{ARTISTS_TABLE}” and “
            {PORTFOLIO_TABLE}” to fill this page. Missing: {missingTables.join(" and ")}.
          </p>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <PartnerPeriod period={period} base="/partners" extra={showAll ? "&all=1" : ""} />
          <Link
            href={`/partners?period=${period}${showAll ? "" : "&all=1"}`}
            className="text-sm font-bold underline underline-offset-4 hover:text-fb-red"
          >
            {showAll ? "Portfolio companies only" : "Include all partners"}
          </Link>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm border-t-2 border-fb-black">
            <thead>
              <tr className="border-b-2 border-fb-black">
                <th className={th}>Partner</th>
                <th className={`${th} text-right`}>Artists</th>
                <th className={`${th} text-right`}>Campaigns</th>
                <th className={`${th} text-right`}>Posts</th>
                <th className={`${th} text-right`}>Total views</th>
                <th className={`${th} text-right`}>Engagement</th>
                <th className={`${th} text-right`}>Spend</th>
                <th className={`${th} text-right`}>Current CPM</th>
                <th className={`${th} text-right`}>Expected CPM</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.name} className="border-b border-fb-black/20">
                  <td className="py-3 pr-4">
                    <Link href={`/partners/${partnerSlug(p.name)}?period=${period}`} className="font-bold hover:text-fb-red">
                      {p.name}
                    </Link>
                    <p className="text-xs">
                      {[p.types.join(", "), p.portfolio ? "Portfolio" : "", p.active ? "" : "Inactive"].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-right" title="With campaigns in this period / on their roster">
                    {p.campaignArtists.length} / {p.rosterArtists.length}
                  </td>
                  <td className="py-3 pr-4 text-right">{p.campaigns.length}</td>
                  <td className="py-3 pr-4 text-right">{p.totals.posts}</td>
                  <td className="py-3 pr-4 text-right figure text-lg text-fb-red">{p.totals.views ? compact(p.totals.views) : "—"}</td>
                  <td className="py-3 pr-4 text-right">{p.totals.views ? pct(p.engagementRate) : "—"}</td>
                  <td className="py-3 pr-4 text-right">{p.spend ? money(p.spend) : "—"}</td>
                  <td className="py-3 pr-4 text-right">{p.currentCpm !== undefined ? money(p.currentCpm, 2) : "—"}</td>
                  <td className="py-3 pr-4 text-right">{p.expected.cpm !== undefined ? money(p.expected.cpm, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && !missingTables.length && <p className="mt-6">No partners to show yet.</p>}
        </div>

        {unmatched.length > 0 && (
          <section className="mt-12">
            <h2 className="headline text-3xl">Not counted</h2>
            <p className="mt-2 max-w-prose text-sm">
              These campaigns aren&apos;t in any partner&apos;s totals. Fix the campaign&apos;s Artist name to match IP DB Roster,
              or add the artist&apos;s partners there.
            </p>
            <ul className="mt-4 border-t-2 border-fb-black text-sm">
              {unmatched.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 border-b border-fb-black/20 py-2">
                  <Link href={`/campaigns/${u.id}`} className="font-bold hover:text-fb-red">
                    {u.name}
                  </Link>
                  <span>
                    Artist “{u.artist || "blank"}”: {u.reason}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
