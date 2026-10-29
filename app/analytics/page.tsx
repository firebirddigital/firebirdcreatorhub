import Link from "next/link";
import { Header } from "@/components/Header";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { PartnerRemoveButton } from "@/components/PartnerRemoveButton";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { artistSignature } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";
import { analyticsHref } from "@/lib/analytics-href";
import { HeroStats } from "@/components/campaign/Shell";
import { StatusTag } from "@/components/StatusTag";
import { getAnalytics, normalize, type BreakdownRow, type Period } from "@/lib/analytics";
import { compact, dateRange, money, pct, shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const parsePeriod = (v?: string): Period => (v === "year" || v === "90d" ? v : "all");
const PERIOD_LABEL: Record<Period, string> = { all: "All time", year: "This year", "90d": "Last 90 days" };

// Team only (behind the login): totals across every campaign, filterable by period, artist and partner.
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; artist?: string; partner?: string }>;
}) {
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const a = await getAnalytics({ period, artist: sp.artist || undefined, partner: sp.partner || undefined });
  const t = a.totals;
  const scope = [a.partner, a.artist].filter(Boolean).join(" · ") || "Every campaign";
  const portfolioRows = a.byPartner.filter((r) => r.portfolio);
  // Shareable results link for each artist in view.
  const origin = await siteOrigin();
  const artistLinks: Record<string, string> = Object.fromEntries(
    await Promise.all(
      a.byArtist.map(async (r) => {
        const key = normalize(r.name);
        return [r.name, `${origin}/artist/${key}/${await artistSignature(key)}`] as const;
      }),
    ),
  );
  const otherRows = a.byPartner.filter((r) => !r.portfolio);

  return (
    <>
      <Header active="analytics" />
      <main className="pb-24">
        <section className="bg-fb-black text-fb-white px-[57px] max-sm:px-6 py-14">
          <p className="subtitle text-lg">
            {scope} · {PERIOD_LABEL[period]}
          </p>
          <h1 className="headline mt-2 text-6xl max-sm:text-4xl">Analytics</h1>
          <p className="figure mt-8 text-8xl max-sm:text-6xl text-fb-red">{compact(t.stats.views)}</p>
          <p className="mt-2 text-lg">
            total views across {t.campaigns} {t.campaigns === 1 ? "campaign" : "campaigns"}
          </p>
          <HeroStats
            items={[
              { label: "Posts", value: compact(t.posts) },
              { label: "Spend", value: t.spend ? money(t.spend) : "—", note: "Approved fees" },
              { label: "Engagement rate", value: t.stats.views ? pct(t.engagementRate) : "—" },
              { label: "Current CPM", value: t.currentCpm !== undefined ? money(t.currentCpm, 2) : "—" },
              { label: "Expected CPM", value: t.expected.cpm !== undefined ? money(t.expected.cpm, 2) : "—" },
            ]}
          />
        </section>

        <div className="px-[57px] max-sm:px-6 pt-10 space-y-14">
          <AnalyticsFilters
            period={period}
            artist={a.artist}
            partner={a.partner}
            artists={a.options.artists}
            partners={a.options.partners}
          />

          {a.rosterSource.kind === "snapshot" && (
            <p className="text-sm">
              Artists and partners from the IP DB Roster export of {shortDate(a.rosterSource.date)}. Send a fresh export to
              update them.
            </p>
          )}

          {a.byPartner.length > 0 && (
            <section>
              <h2 className="headline text-3xl">By partner</h2>
              <p className="mt-2 max-w-prose text-sm">
                A campaign counts toward every partner of its artist (management, label, publisher), so partner rows can overlap
                and won&apos;t add up to the total.
              </p>
              <Breakdown rows={portfolioRows.length ? portfolioRows : otherRows} kind="partner" period={period} artist={a.artist} partner={a.partner} />
              {portfolioRows.length > 0 && otherRows.length > 0 && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-bold underline underline-offset-4">
                    Other partners ({otherRows.length})
                  </summary>
                  <Breakdown rows={otherRows} kind="partner" period={period} artist={a.artist} partner={a.partner} />
                </details>
              )}
            </section>
          )}

          {a.removedPartners.length > 0 && (
            <section>
              <h2 className="subtitle text-sm">Removed partners</h2>
              <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {a.removedPartners.map((n) => (
                  <li key={n} className="flex items-baseline gap-2">
                    <span>{n}</span>
                    <PartnerRemoveButton name={n} restore />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {a.byArtist.length > 0 && (
            <section>
              <h2 className="headline text-3xl">By artist</h2>
              <Breakdown rows={a.byArtist} kind="artist" period={period} partner={a.partner} shareLinks={artistLinks} />
            </section>
          )}

          <section>
            <h2 className="headline text-3xl">Campaigns</h2>
            {a.campaigns.length === 0 ? (
              <p className="mt-4">No campaigns match these filters.</p>
            ) : (
              <ul className="mt-6 border-t-2 border-fb-black">
                {a.campaigns.map((c) => (
                  <li key={c.id} className="border-b border-fb-black/20">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="group grid grid-cols-[1fr_auto] md:grid-cols-[1.4fr_0.6fr_0.4fr_0.5fr] items-center gap-x-8 gap-y-1 py-5"
                    >
                      <div>
                        <p className="text-sm">
                          {c.artist}
                          {c.partners.length > 0 && <span> · {c.partners.join(", ")}</span>}
                        </p>
                        <h3 className="subtitle text-xl mt-1 group-hover:text-fb-red transition-colors">{c.name}</h3>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                          <StatusTag status={c.status} />
                          <span>{dateRange(c.startDate)}</span>
                        </div>
                      </div>
                      <p className="figure text-4xl text-fb-red text-right md:text-left">{c.stats.views ? compact(c.stats.views) : "—"}</p>
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

          {a.unmatched.length > 0 && (
            <section>
              <h2 className="headline text-3xl">Not in any partner&apos;s totals</h2>
              <p className="mt-2 max-w-prose text-sm">
                These still count in the overall totals. To credit them to a partner, make the campaign&apos;s Artist match IP DB
                Roster, or add the artist&apos;s partners there.
              </p>
              <ul className="mt-4 border-t-2 border-fb-black text-sm">
                {a.unmatched.map((u) => (
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
        </div>
      </main>
    </>
  );
}

function Breakdown({
  rows,
  kind,
  period,
  artist,
  partner,
  shareLinks,
}: {
  rows: BreakdownRow[];
  kind: "partner" | "artist";
  period: Period;
  artist?: string;
  partner?: string;
  shareLinks?: Record<string, string>;
}) {
  const th = "py-3 pr-4 text-xs font-bold whitespace-nowrap text-right";
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[900px] text-sm border-t-2 border-fb-black">
        <thead>
          <tr className="border-b-2 border-fb-black">
            <th className={`${th} text-left`}>{kind === "partner" ? "Partner" : "Artist"}</th>
            <th className={th}>Campaigns</th>
            <th className={th}>Posts</th>
            <th className={th}>Total views</th>
            <th className={th}>Engagement</th>
            <th className={th}>Spend</th>
            <th className={th}>Current CPM</th>
            <th className={th}>Expected CPM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-fb-black/20">
              <td className="py-3 pr-4">
                <Link
                  href={analyticsHref(kind === "partner" ? { period, artist, partner: r.name } : { period, partner, artist: r.name })}
                  className="font-bold hover:text-fb-red"
                >
                  {r.name}
                </Link>
                {kind === "partner" && (
                  <p className="text-xs flex flex-wrap items-baseline gap-x-3">
                    <span>
                    {[r.types?.join(", "), r.rosterArtists ? `${r.rosterArtists} roster ${r.rosterArtists === 1 ? "artist" : "artists"}` : ""].filter(Boolean).join(" · ")}
                    </span>
                    <PartnerRemoveButton name={r.name} leaveFilter={partner === r.name ? analyticsHref({ period, artist }) : undefined} />
                  </p>
                )}
                {shareLinks?.[r.name] && (
                  <p className="text-xs">
                    <CopyLinkButton url={shareLinks[r.name]} label="Copy results link" />
                    <a href={shareLinks[r.name]} target="_blank" rel="noreferrer" className="ml-3 underline underline-offset-4 hover:text-fb-red">
                      Preview
                    </a>
                  </p>
                )}
              </td>
              <td className="py-3 pr-4 text-right">{r.campaigns}</td>
              <td className="py-3 pr-4 text-right">{r.posts}</td>
              <td className="py-3 pr-4 text-right figure text-lg text-fb-red">{r.stats.views ? compact(r.stats.views) : "—"}</td>
              <td className="py-3 pr-4 text-right">{r.stats.views ? pct(r.engagementRate) : "—"}</td>
              <td className="py-3 pr-4 text-right">{r.spend ? money(r.spend) : "—"}</td>
              <td className="py-3 pr-4 text-right">{r.currentCpm !== undefined ? money(r.currentCpm, 2) : "—"}</td>
              <td className="py-3 pr-4 text-right">{r.expected.cpm !== undefined ? money(r.expected.cpm, 2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
