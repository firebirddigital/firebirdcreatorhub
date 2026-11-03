import Link from "next/link";
import { TeamShell } from "@/components/Header";
import { PageHead } from "@/components/nest/Rail";
import { StatTile } from "@/components/nest/StatTile";
import { AnalyticsFilters } from "@/components/AnalyticsFilters";
import { PartnerRemoveButton } from "@/components/PartnerRemoveButton";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { artistSignature } from "@/lib/auth";
import { siteOrigin } from "@/lib/origin";
import { analyticsHref } from "@/lib/analytics-href";
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
    <TeamShell active="analytics">
      <PageHead title="Analytics" />
      <p className="mt-1 text-xs text-muted">
        {scope} · {PERIOD_LABEL[period]}
      </p>

      <div className="filters page-filters">
        <AnalyticsFilters
          period={period}
          artist={a.artist}
          partner={a.partner}
          artists={a.options.artists}
          partners={a.options.partners}
        />
      </div>

      <div className="grid cards">
        <StatTile
          hero
          label="Views"
          value={compact(t.stats.views)}
          deltaNote={`total views across ${t.campaigns} ${t.campaigns === 1 ? "campaign" : "campaigns"}`}
        />
        <StatTile label="Posts" value={compact(t.posts)} deltaNote="" />
        <StatTile label="Spend" value={t.spend ? money(t.spend) : "—"} deltaNote="Approved fees" />
        <StatTile label="Engagement rate" value={t.stats.views ? pct(t.engagementRate) : "—"} deltaNote="" />
      </div>
      <div className="grid two-col mt-3.5">
        <StatTile label="Current CPM" value={t.currentCpm !== undefined ? money(t.currentCpm, 2) : "—"} deltaNote="" />
        <StatTile label="Expected CPM" value={t.expected.cpm !== undefined ? money(t.expected.cpm, 2) : "—"} deltaNote="" />
      </div>

      {a.rosterSource.kind === "snapshot" && (
        <p className="banner mt-3.5">
          Artists and partners from the IP DB Roster export of {shortDate(a.rosterSource.date)}. Send a fresh export to
          update them.
        </p>
      )}

      {a.byPartner.length > 0 && (
        <>
          <h2 className="section-title">By partner</h2>
          <section className="card">
            <p className="caption max-w-prose">
              A campaign counts toward every partner of its artist (management, label, publisher), so partner rows can overlap
              and won&apos;t add up to the total.
            </p>
            <Breakdown rows={portfolioRows.length ? portfolioRows : otherRows} kind="partner" period={period} artist={a.artist} partner={a.partner} />
            {portfolioRows.length > 0 && otherRows.length > 0 && (
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-bold text-secondary hover:text-fb-red">
                  Other partners ({otherRows.length})
                </summary>
                <div className="mt-3">
                  <Breakdown rows={otherRows} kind="partner" period={period} artist={a.artist} partner={a.partner} />
                </div>
              </details>
            )}
          </section>
        </>
      )}

      {a.removedPartners.length > 0 && (
        <section className="card mt-3.5">
          <h2>Removed partners</h2>
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
        <>
          <h2 className="section-title">By artist</h2>
          <section className="card">
            <Breakdown rows={a.byArtist} kind="artist" period={period} partner={a.partner} shareLinks={artistLinks} />
          </section>
        </>
      )}

      <h2 className="section-title">Campaigns</h2>
      <section className="card">
        {a.campaigns.length === 0 ? (
          <p className="empty">No campaigns match these filters.</p>
        ) : (
          <ul className="-mx-2">
            {a.campaigns.map((c) => (
              <li key={c.id} className="border-b border-line last:border-b-0">
                <Link
                  href={`/campaigns/${c.id}`}
                  className="group grid grid-cols-[1fr_auto] md:grid-cols-[1.4fr_0.6fr_0.4fr_0.5fr] items-center gap-x-6 gap-y-2 rounded-control px-2 py-4 transition-colors hover:bg-wash-neutral"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted truncate">
                      {c.artist}
                      {c.partners.length > 0 && <span> · {c.partners.join(", ")}</span>}
                    </p>
                    <h3 className="mt-0.5 font-display text-[15px] font-bold tracking-[0.02em] group-hover:text-fb-red transition-colors">
                      {c.name}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <StatusTag status={c.status} />
                      <span>{dateRange(c.startDate)}</span>
                    </div>
                  </div>
                  <p className="tile-value text-fb-red text-right md:text-left">{c.stats.views ? compact(c.stats.views) : "—"}</p>
                  <p className="max-md:hidden">
                    <span className="tile-value block text-[22px]">{c.posts}</span>
                    <span className="block text-xs text-muted">posts</span>
                  </p>
                  <p className="max-md:hidden">
                    <span className="tile-value block text-[22px]">{c.spend ? money(c.spend) : "—"}</span>
                    <span className="block text-xs text-muted">spend</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {a.unmatched.length > 0 && (
        <>
          <h2 className="section-title">Not in any partner&apos;s totals</h2>
          <section className="card">
            <p className="caption max-w-prose">
              These still count in the overall totals. To credit them to a partner, make the campaign&apos;s Artist match IP DB
              Roster, or add the artist&apos;s partners there.
            </p>
            <ul className="text-sm">
              {a.unmatched.map((u) => (
                <li key={u.id} className="flex flex-wrap justify-between gap-2 border-b border-line py-2 last:border-b-0">
                  <Link href={`/campaigns/${u.id}`} className="font-bold hover:text-fb-red">
                    {u.name}
                  </Link>
                  <span className="text-secondary">
                    Artist “{u.artist || "blank"}”: {u.reason}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </TeamShell>
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
  return (
    <div className="table-wrap">
      <table className="min-w-[900px]">
        <thead>
          <tr>
            <th>{kind === "partner" ? "Partner" : "Artist"}</th>
            <th className="num">Campaigns</th>
            <th className="num">Posts</th>
            <th className="num">Total views</th>
            <th className="num">Engagement</th>
            <th className="num">Spend</th>
            <th className="num">Current CPM</th>
            <th className="num">Expected CPM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>
                <Link
                  href={analyticsHref(kind === "partner" ? { period, artist, partner: r.name } : { period, partner, artist: r.name })}
                  className="font-bold hover:text-fb-red"
                >
                  {r.name}
                </Link>
                {kind === "partner" && (
                  <p className="mt-0.5 text-xs text-muted flex flex-wrap items-baseline gap-x-3">
                    <span>
                    {[r.types?.join(", "), r.rosterArtists ? `${r.rosterArtists} roster ${r.rosterArtists === 1 ? "artist" : "artists"}` : ""].filter(Boolean).join(" · ")}
                    </span>
                    <PartnerRemoveButton name={r.name} leaveFilter={partner === r.name ? analyticsHref({ period, artist }) : undefined} />
                  </p>
                )}
                {shareLinks?.[r.name] && (
                  <p className="mt-1 flex items-center gap-1 text-xs">
                    <CopyLinkButton url={shareLinks[r.name]} label="Copy results link" />
                    <a href={shareLinks[r.name]} target="_blank" rel="noreferrer" className="ml-2 underline underline-offset-4 hover:text-fb-red">
                      Preview
                    </a>
                  </p>
                )}
              </td>
              <td className="num">{r.campaigns}</td>
              <td className="num">{r.posts}</td>
              <td className="num font-display font-extrabold text-fb-red">{r.stats.views ? compact(r.stats.views) : "—"}</td>
              <td className="num">{r.stats.views ? pct(r.engagementRate) : "—"}</td>
              <td className="num">{r.spend ? money(r.spend) : "—"}</td>
              <td className="num">{r.currentCpm !== undefined ? money(r.currentCpm, 2) : "—"}</td>
              <td className="num">{r.expected.cpm !== undefined ? money(r.expected.cpm, 2) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
