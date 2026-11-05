import { compact, expectedCpm, median, money } from "@/lib/format";
import type { Assignment, AssignmentStatus, TrackRecord } from "@/lib/types";
import { trackRecordText } from "../TrackRecordLine";
import { HeroFigure, HeroStats } from "./Shell";
import { ReviewControls } from "./ReviewControls";
import { AssignmentControls } from "./TeamControls";
import { CreatorEditButton } from "./CreatorEditButton";
import { RateCardEditor } from "./RateCardEditor";
import { BulkBar, BulkSelectProvider, SelectBox } from "./BulkSelect";

const reach = (a: Assignment) => (a.creator ? a.creator.instagramFollowers + a.creator.tiktokFollowers : 0);

export function CreatorsHero({ roster, showFees }: { roster: Assignment[]; showFees: boolean }) {
  const active = roster.filter((a) => a.status !== "Declined");
  const approved = roster.filter((a) => a.status === "Approved");
  const awaiting = roster.filter((a) => a.status === "Proposed").length;
  const avgs = active.map((a) => a.creator?.avgViews ?? 0).filter(Boolean);
  const fees = approved.reduce((t, a) => t + (a.fee ?? 0), 0);
  // Cost per post is the campaign fee, or the creator's general rate when no fee is set yet.
  const expected = expectedCpm(active.map((a) => ({ cost: a.fee ?? a.creator?.rate, avgViews: a.creator?.avgViews })));
  return (
    <>
      <HeroFigure
        value={compact(active.reduce((t, a) => t + reach(a), 0))}
        caption={
          <>
            combined followers across {active.length} {active.length === 1 ? "creator" : "creators"}
          </>
        }
      />
      <HeroStats
        items={[
          { label: "Approved", value: String(approved.length) },
          { label: "Awaiting review", value: String(awaiting) },
          {
            label: "Median views, last 10 posts",
            value: avgs.length ? compact(median(avgs) ?? 0) : "—",
          },
          ...(showFees
            ? [
                { label: "Approved fees", value: fees ? money(fees) : "—" },
                {
                  label: "Expected CPM",
                  value: expected.cpm !== undefined ? money(expected.cpm, 2) : "—",
                  note:
                    expected.cpm === undefined
                      ? "Needs fees or rates, and median views"
                      : expected.counted < expected.total
                        ? `From ${expected.counted} of ${expected.total} creators`
                        : "Cost per post ÷ median views × 1,000",
                },
              ]
            : []),
        ]}
      />
    </>
  );
}

const STATUS_STYLE: Record<AssignmentStatus, { label: string; className: string }> = {
  Approved: { label: "Approved", className: "border-fb-red bg-fb-red text-white" },
  Proposed: { label: "Awaiting review", className: "bg-surface text-fb-black" },
  "Changes requested": { label: "Changes requested", className: "border-white/40 bg-fb-ink text-white" },
  Declined: { label: "Passed", className: "bg-surface text-muted" },
};

export function CreatorsBody({
  roster,
  showFees,
  partner,
  team,
}: {
  roster: Assignment[];
  showFees: boolean;
  partner?: { reviewEndpoint: string };
  team?: { campaignId: string; uploadUrls: Record<string, string>; tools: React.ReactNode; trackRecords?: Record<string, TrackRecord> };
}) {
  return (
    <>
      {team?.tools}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-x-4">
          <h2 className="section-title flex-1">The creators</h2>
          {partner && roster.some((a) => a.status === "Proposed") && (
            <p className="mb-3 max-w-md text-sm text-secondary">
              Approve the creators you&apos;re happy with, or request a change and tell us why. We&apos;ll update this
              page as we go.
            </p>
          )}
        </div>
        {roster.length ? (
          <MaybeSelectable team={team} ids={roster.map((a) => a.id)}>
            <ul className="mt-3.5 grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
              {roster.map((a) => (
                <li key={a.id} className={`card relative flex flex-col p-3 ${a.status === "Declined" ? "opacity-60" : ""}`}>
                  {team && <SelectBox id={a.id} label={a.creator?.name ?? "creator"} />}
                  <RosterCard
                    assignment={a}
                    showFee={showFees}
                    showPaid={Boolean(team)}
                    trackRecord={team && a.creatorId ? trackRecordText(team.trackRecords?.[a.creatorId]) ?? "First Firebird campaign" : undefined}
                  />
                  {(team || showFees) && (
                    <div className="mt-3 border-t border-line px-1 pt-3 empty:hidden">
                      <RateCardEditor
                        key={JSON.stringify(a.rates ?? {})}
                        campaignId={a.campaignId}
                        assignmentId={a.id}
                        rates={a.rates}
                        editable={Boolean(team)}
                      />
                    </div>
                  )}
                  <div className="mt-4 px-1 empty:hidden">
                    {partner && a.status !== "Declined" && (
                      <ReviewControls
                        endpoint={partner.reviewEndpoint}
                        kind="creator"
                        recordId={a.id}
                        allowDecline
                        decided={a.status !== "Proposed"}
                      />
                    )}
                    {team && a.creator && (
                      <div className="mb-4">
                        <CreatorEditButton key={JSON.stringify(a.creator)} creator={a.creator} />
                      </div>
                    )}
                    {team && (
                      <AssignmentControls
                        campaignId={team.campaignId}
                        assignmentId={a.id}
                        status={a.status}
                        fee={a.fee}
                        paid={a.paid}
                        uploadUrl={team.uploadUrls[a.id]}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </MaybeSelectable>
        ) : (
          <p className="empty card">
            {team
              ? "No creators yet. Search the roster above to propose the first few."
              : "We're putting the creator list together. Check back soon."}
          </p>
        )}
      </section>
    </>
  );
}

function RosterCard({
  assignment: a,
  showFee,
  showPaid,
  trackRecord,
}: {
  assignment: Assignment;
  showFee: boolean;
  /** Team only: a Paid tag on the photo. */
  showPaid?: boolean;
  trackRecord?: string;
}) {
  const c = a.creator;
  const status = STATUS_STYLE[a.status];
  const initials = (c?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <article>
      <div className="relative aspect-[4/5] bg-fb-ink overflow-hidden rounded-control">
        {c?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo} alt="" className="bw absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-end p-5 headline text-white text-6xl">
            {initials}
          </span>
        )}
        <span className={`pill absolute left-2 top-2 shadow-lift ${status.className}`}>
          {status.label}
        </span>
        {showPaid && a.status === "Approved" && (
          <span className={`pill absolute bottom-2 right-2 shadow-lift ${a.paid ? "bg-surface text-fb-black" : "border-fb-red bg-fb-red text-white"}`}>
            {a.paid ? "Paid" : "Unpaid"}
          </span>
        )}
      </div>

      <h3 className="mt-3 px-1 font-display text-[15px] font-bold uppercase tracking-[0.04em]">{c?.name ?? "Creator"}</h3>
      {c?.location && <p className="px-1 text-xs text-muted">{c.location}</p>}

      <dl className="mx-1 mt-3 border-t border-line">
        {c?.tiktok && (
          <Row label="TikTok" handle={c.tiktok} href={`https://www.tiktok.com/@${c.tiktok}`} value={c.tiktokFollowers} />
        )}
        {c?.instagram && (
          <Row
            label="Instagram"
            handle={c.instagram}
            href={`https://www.instagram.com/${c.instagram}/`}
            value={c.instagramFollowers}
          />
        )}
        <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
          <dt className="text-xs text-secondary">Median views (last 10 posts)</dt>
          <dd className="font-display text-[15px] font-extrabold tabular-nums">{c?.avgViews ? compact(c.avgViews) : "—"}</dd>
        </div>
        {trackRecord && (
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0" title="Across all Firebird campaigns. Team only.">
            <dt className="text-xs text-secondary">Track record</dt>
            <dd className="text-xs font-bold text-right">{trackRecord}</dd>
          </div>
        )}
        {showFee && (
          <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <dt className="text-xs text-secondary">Fee</dt>
            <dd className="font-display text-[15px] font-extrabold tabular-nums">
              {a.fee ? money(a.fee) : c?.rate ? <span title="No fee set yet; their general rate">{money(c.rate)} rate</span> : "—"}
            </dd>
          </div>
        )}
        {showFee && (
          <div
            className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0"
            title={
              (a.fee ?? c?.rate) && c?.avgViews
                ? "Cost per post ÷ median views × 1,000"
                : !(a.fee ?? c?.rate)
                  ? "Needs a fee or rate"
                  : "Needs their median views (stats not pulled yet)"
            }
          >
            <dt className="text-xs text-secondary">Expected CPM</dt>
            <dd className="font-display text-[15px] font-extrabold tabular-nums">
              {(a.fee ?? c?.rate) && c?.avgViews ? money((((a.fee ?? c.rate) as number) / c.avgViews) * 1000, 2) : "—"}
            </dd>
          </div>
        )}
      </dl>

      {!!c?.tags.length && (
        <ul className="mt-3 flex flex-wrap gap-1.5 px-1">
          {c.tags.map((t) => (
            <li key={t} className="pill text-secondary">
              {t}
            </li>
          ))}
        </ul>
      )}

      {a.partnerComment && (
        <blockquote className="banner mx-1 mt-4 mb-0 text-sm">
          {a.partnerComment}
          {a.reviewedBy && <footer className="mt-1 text-xs text-muted">{a.reviewedBy}</footer>}
        </blockquote>
      )}
    </article>
  );
}

function Row({ label, handle, href, value }: { label: string; handle: string; href: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="min-w-0 text-xs text-secondary truncate">
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-fb-red">
          <span className="font-bold text-fb-black">{label}</span> @{handle}
        </a>
      </dt>
      <dd className="font-display text-[15px] font-extrabold tabular-nums">{value ? compact(value) : "—"}</dd>
    </div>
  );
}

/** On the team page, the creator cards can be selected and removed from the campaign together. */
function MaybeSelectable({ team, ids, children }: { team?: { campaignId: string }; ids: string[]; children: React.ReactNode }) {
  if (!team) return <>{children}</>;
  return (
    <BulkSelectProvider>
      <BulkBar
        allIds={ids}
        noun={["creator", "creators"]}
        action="Remove from campaign"
        confirmText="Remove {items} from this campaign? They stay in your Creators database, and any posts already added stay on the Live tab."
        endpoint={`/api/campaigns/${team.campaignId}/roster`}
        bodyKey="assignmentIds"
      />
      {children}
    </BulkSelectProvider>
  );
}
