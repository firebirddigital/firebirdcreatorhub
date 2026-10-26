import { compact, money } from "@/lib/format";
import type { Assignment, AssignmentStatus } from "@/lib/types";
import { HeroFigure, HeroStats } from "./Shell";
import { ReviewControls } from "./ReviewControls";
import { AssignmentControls } from "./TeamControls";

const reach = (a: Assignment) => (a.creator ? a.creator.instagramFollowers + a.creator.tiktokFollowers : 0);

export function CreatorsHero({ roster, showFees }: { roster: Assignment[]; showFees: boolean }) {
  const active = roster.filter((a) => a.status !== "Declined");
  const approved = roster.filter((a) => a.status === "Approved");
  const awaiting = roster.filter((a) => a.status === "Proposed").length;
  const avgs = active.map((a) => a.creator?.avgViews ?? 0).filter(Boolean);
  const fees = approved.reduce((t, a) => t + (a.fee ?? 0), 0);
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
            label: "Avg views per post",
            value: avgs.length ? compact(avgs.reduce((a, b) => a + b, 0) / avgs.length) : "—",
          },
          ...(showFees ? [{ label: "Approved fees", value: fees ? money(fees) : "—" }] : []),
        ]}
      />
    </>
  );
}

const STATUS_STYLE: Record<AssignmentStatus, { label: string; className: string }> = {
  Approved: { label: "Approved", className: "bg-fb-red text-fb-white" },
  Proposed: { label: "Awaiting review", className: "border-2 border-fb-black bg-fb-white" },
  "Changes requested": { label: "Changes requested", className: "bg-fb-black text-fb-white" },
  Declined: { label: "Passed", className: "border-2 border-fb-black/40 bg-fb-white text-fb-black/60" },
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
  team?: { campaignId: string; uploadUrls: Record<string, string>; tools: React.ReactNode };
}) {
  return (
    <>
      {team?.tools}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="headline text-3xl">The creators</h2>
          {partner && roster.some((a) => a.status === "Proposed") && (
            <p className="max-w-md text-sm">
              Approve the creators you&apos;re happy with, or request a change and tell us why. We&apos;ll update this
              page as we go.
            </p>
          )}
        </div>
        {roster.length ? (
          <ul className="mt-8 grid gap-x-8 gap-y-14 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {roster.map((a) => (
              <li key={a.id} className={a.status === "Declined" ? "opacity-60" : undefined}>
                <RosterCard assignment={a} showFee={showFees} />
                <div className="mt-4">
                  {partner && a.status !== "Declined" && (
                    <ReviewControls
                      endpoint={partner.reviewEndpoint}
                      kind="creator"
                      recordId={a.id}
                      allowDecline
                      decided={a.status !== "Proposed"}
                    />
                  )}
                  {team && (
                    <AssignmentControls
                      campaignId={team.campaignId}
                      assignmentId={a.id}
                      status={a.status}
                      fee={a.fee}
                      uploadUrl={team.uploadUrls[a.id]}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-8 max-w-prose">
            {team
              ? "No creators yet. Search the roster above to propose the first few."
              : "We're putting the creator list together. Check back soon."}
          </p>
        )}
      </section>
    </>
  );
}

function RosterCard({ assignment: a, showFee }: { assignment: Assignment; showFee: boolean }) {
  const c = a.creator;
  const status = STATUS_STYLE[a.status];
  const initials = (c?.name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <article>
      <div className="relative aspect-[4/5] bg-fb-black overflow-hidden">
        {c?.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo} alt="" className="bw absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-end p-5 headline text-fb-white text-7xl">
            {initials}
          </span>
        )}
        <span className={`absolute left-0 top-0 px-2.5 py-1 text-xs font-bold ${status.className}`}>
          {status.label}
        </span>
      </div>

      <h3 className="subtitle mt-4 text-xl">{c?.name ?? "Creator"}</h3>
      {c?.location && <p className="text-sm">{c.location}</p>}

      <dl className="mt-3 border-t-2 border-fb-black">
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
        <div className="flex items-baseline justify-between gap-3 border-b border-fb-black/20 py-2">
          <dt className="text-sm">Avg views per post</dt>
          <dd className="figure text-lg">{c?.avgViews ? compact(c.avgViews) : "—"}</dd>
        </div>
        {showFee && (
          <div className="flex items-baseline justify-between gap-3 border-b border-fb-black/20 py-2">
            <dt className="text-sm">Fee</dt>
            <dd className="figure text-lg">{a.fee ? money(a.fee) : "—"}</dd>
          </div>
        )}
      </dl>

      {!!c?.tags.length && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {c.tags.map((t) => (
            <li key={t} className="text-xs font-bold px-2 py-0.5 border border-fb-black">
              {t}
            </li>
          ))}
        </ul>
      )}

      {a.partnerComment && (
        <blockquote className="mt-4 border-l-4 border-fb-red pl-3 text-sm">
          {a.partnerComment}
          {a.reviewedBy && <footer className="mt-1 text-xs">{a.reviewedBy}</footer>}
        </blockquote>
      )}
    </article>
  );
}

function Row({ label, handle, href, value }: { label: string; handle: string; href: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-fb-black/20 py-2">
      <dt className="min-w-0 text-sm truncate">
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-fb-red">
          <span className="font-bold">{label}</span> @{handle}
        </a>
      </dt>
      <dd className="figure text-lg">{value ? compact(value) : "—"}</dd>
    </div>
  );
}
