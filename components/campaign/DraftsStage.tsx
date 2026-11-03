import { draftSource } from "@/lib/draft-links";
import { compact, creatorCpm, money, shortDate } from "@/lib/format";
import type { Assignment, Creator, Draft, DraftPlatform, DraftStatus } from "@/lib/types";
import { HeroFigure, HeroStats } from "./Shell";
import { ReviewControls } from "./ReviewControls";
import { TeamDraftForm } from "./TeamDraftForm";
import { CopyButton, FeeField, PaidToggle } from "./TeamControls";
import { ModalButton } from "./Modal";
import { DeleteDraftButton } from "./DeleteDraftButton";
import { TeamDraftReview } from "./TeamDraftReview";
import { BulkBar, BulkSelectProvider, SelectBox } from "./BulkSelect";

interface Lane {
  assignment: Assignment;
  drafts: Draft[]; // newest first
}

export function buildLanes(roster: Assignment[], drafts: Draft[]): Lane[] {
  return roster
    .filter((a) => a.status === "Approved" || drafts.some((d) => d.assignmentId === a.id))
    .map((a) => ({
      assignment: a,
      drafts: drafts.filter((d) => d.assignmentId === a.id).sort((x, y) => y.version - x.version),
    }));
}

export function DraftsHero({ lanes }: { lanes: Lane[] }) {
  const latest = lanes.map((l) => l.drafts[0]);
  const approved = latest.filter((d) => d?.status === "Approved").length;
  const pending = latest.filter((d) => d?.status === "Pending review").length;
  const changes = latest.filter((d) => d?.status === "Changes requested").length;
  const waiting = latest.filter((d) => !d).length;
  return (
    <>
      <HeroFigure
        value={`${approved}/${lanes.length}`}
        caption={<>drafts approved and ready to post</>}
      />
      <HeroStats
        items={[
          { label: "Awaiting review", value: String(pending) },
          { label: "Changes requested", value: String(changes) },
          { label: "Not submitted yet", value: String(waiting) },
        ]}
      />
    </>
  );
}

/** The creator's handles, linked to their profiles, and (when shown) their cost for this campaign. */
function CreatorMeta({ assignment: a, showCost, showCpm }: { assignment: Assignment; showCost: boolean; showCpm: boolean }) {
  const c = a.creator;
  const cost = a.fee ? money(a.fee) : c?.rate ? `${money(c.rate)} rate` : undefined;
  const cpm = creatorCpm({ rate: a.fee ?? c?.rate, avgViews: c?.avgViews });
  const handles = [
    c?.tiktok && { label: `TikTok @${c.tiktok}`, href: `https://www.tiktok.com/@${c.tiktok}` },
    c?.instagram && { label: `Instagram @${c.instagram}`, href: `https://www.instagram.com/${c.instagram}/` },
  ].filter((h): h is { label: string; href: string } => Boolean(h));
  // Median views and CPM always show, as a dash when they can't be worked out yet, so every creator lines up.
  const cpmMissing = !(a.fee ?? c?.rate) ? "Needs a fee or rate" : "Needs their median views (stats not pulled yet)";
  return (
    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-secondary">
      {handles.map((h) => (
        <a key={h.href} href={h.href} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fb-red transition-colors">
          {h.label}
        </a>
      ))}
      <span className="font-bold text-fb-black" title={c?.avgViews ? "Median views across their last 10 posts" : "Stats not pulled yet"}>
        {c?.avgViews ? compact(c.avgViews) : "—"} median views
      </span>
      {showCost && cost && (
        <span className="font-bold text-fb-black" title={a.fee ? "Fee for this campaign" : "No fee set yet; their general rate"}>
          {cost}
        </span>
      )}
      {showCpm && (
        <span className="font-bold text-fb-black" title={cpm !== undefined ? "Cost ÷ their median views (last 10 posts) × 1,000" : cpmMissing}>
          {cpm !== undefined ? money(cpm, 2) : "—"} CPM
        </span>
      )}
    </p>
  );
}

const STATUS: Record<DraftStatus, { label: string; className: string }> = {
  "Pending review": { label: "Awaiting review", className: "border-line-strong bg-fb-white text-fb-black" },
  Approved: { label: "Approved", className: "border-fb-red bg-fb-red text-white" },
  "Changes requested": { label: "Changes requested", className: "border-white/60 bg-fb-ink text-white" },
};

/** Plays a draft in place: our own files and Dropbox in a video tag, YouTube, Vimeo and Drive in their player. */
function DraftPlayer({ url }: { url: string }) {
  const source = draftSource(url);
  const { player } = source;
  if (player.kind === "video") {
    return (
      <video
        src={player.src}
        controls
        playsInline
        preload="metadata"
        className="absolute inset-0 h-full w-full object-contain bg-fb-ink"
      />
    );
  }
  if (player.kind === "iframe") {
    return (
      <iframe
        src={player.src}
        title={`Draft on ${source.label}`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0 bg-fb-ink"
      />
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-5 text-white">
      <span className="text-sm text-white/75">This draft is on {source.label}.</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="btn border-fb-red bg-fb-red text-white hover:border-white hover:bg-white hover:text-fb-ink"
      >
        Open draft
      </a>
    </div>
  );
}

/**
 * One version of a creator's draft: player, status, caption, notes and (for partners) review buttons.
 * With `name` it's a creator's only card and shows their name; in a multi-version row it shows the version.
 */
function VersionCard({
  draft: d,
  name,
  meta,
  latest,
  partner,
  teamCampaignId,
  creatorName,
}: {
  draft?: Draft;
  name?: string;
  /** Team view: shows Delete draft. */
  teamCampaignId?: string;
  /** For the delete confirmation in a multi-version row, where the name isn't on the card. */
  creatorName?: string;
  /** Handles and cost, under the creator's name. */
  meta?: React.ReactNode;
  latest?: boolean;
  partner?: { reviewEndpoint: string };
}) {
  const source = d?.videoUrl ? draftSource(d.videoUrl) : undefined;
  return (
    <>
      <div className="relative aspect-[9/16] overflow-hidden rounded-control bg-fb-ink">
        {d?.videoUrl ? (
          <DraftPlayer url={d.videoUrl} />
        ) : (
          <div className="absolute inset-0 flex flex-col justify-end p-5 text-white">
            <span className="subtitle text-[11px] tracking-[0.11em]">{d ? `Version ${d.version}` : "Waiting on draft"}</span>
            <span className="mt-2 text-sm text-white/75">
              {d ? "Sample draft. Real uploads play here." : "The creator hasn't uploaded yet."}
            </span>
          </div>
        )}
        {d && (
          <span className={`pill absolute left-2 top-2 ${STATUS[d.status].className}`}>
            {STATUS[d.status].label}
          </span>
        )}
      </div>

      <div className="mt-3.5 flex items-baseline justify-between gap-3">
        {name ? (
          <h3 className="font-display text-[15px] font-bold tracking-[0.02em] truncate">{name}</h3>
        ) : (
          <p className="font-display text-[15px] font-bold tracking-[0.02em]">
            Version {d?.version}
            {latest && <span className="pill ml-2 align-middle text-secondary">Latest</span>}
          </p>
        )}
        {d && (
          <span className="text-xs text-muted shrink-0">
            {name ? `v${d.version}, ` : ""}
            {shortDate(d.submittedAt)}
          </span>
        )}
      </div>
      {meta}
      {d?.platforms?.length ? <PostingOn platforms={d.platforms} creator={d.creator} /> : null}
      {(d?.submittedBy || (source && !source.hosted)) && (
        <p className="mt-1 text-xs text-muted">
          {d?.submittedBy && <>Added by {d.submittedBy}. </>}
          {d?.videoUrl && source && !source.hosted && (
            <a href={d.videoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fb-red transition-colors">
              Open on {source.label}
            </a>
          )}
        </p>
      )}
      {d?.caption && <p className="mt-2.5 border-l-2 border-line-strong pl-3 text-sm text-secondary">{d.caption}</p>}
      {d?.partnerComment && (
        <blockquote className="mt-3 rounded-r-control border-l-[3px] border-fb-red bg-wash-neutral py-2 pl-3 pr-3 text-sm">
          {d.partnerComment}
          {d.reviewedBy && <footer className="mt-1 text-xs text-muted">{d.reviewedBy}</footer>}
        </blockquote>
      )}
      {teamCampaignId && d && (
        <div className="mt-4 border-t border-line pt-3.5">
          <TeamDraftReview campaignId={teamCampaignId} draftId={d.id} decided={d.status !== "Pending review"} />
        </div>
      )}
      {teamCampaignId && d && (
        <p className="mt-3">
          <DeleteDraftButton
            campaignId={teamCampaignId}
            draftId={d.id}
            label={`${name ?? creatorName ?? "this creator"}'s version ${d.version}`}
          />
        </p>
      )}
      {partner && d && (
        <div className="mt-4 border-t border-line pt-3.5">
          <ReviewControls
            endpoint={partner.reviewEndpoint}
            kind="draft"
            recordId={d.id}
            decided={d.status !== "Pending review"}
          />
        </div>
      )}
    </>
  );
}

function TeamLaneControls({
  assignment: a,
  name,
  uploadUrl,
  campaignId,
  sample,
  compact = false,
}: {
  assignment: Assignment;
  name: string;
  uploadUrl: string;
  campaignId: string;
  sample: boolean;
  /** The one-line version for creators who haven't sent a draft yet. */
  compact?: boolean;
}) {
  const fixed = { assignmentId: a.id, name, instagram: a.creator?.instagram, tiktok: a.creator?.tiktok };
  return (
    <div className={compact ? "flex flex-wrap items-end gap-x-6 gap-y-3" : ""}>
      <FeeField
        key={a.fee ?? "none"}
        campaignId={campaignId}
        assignmentId={a.id}
        fee={a.fee}
        rate={a.creator?.rate}
        className={compact ? "w-32" : "w-40 mb-3"}
      />
      <div className={compact ? "" : "mb-3"}>
        <PaidToggle key={String(a.paid)} campaignId={campaignId} assignmentId={a.id} paid={a.paid} />
      </div>
      <CopyButton text={uploadUrl} label="Copy draft upload link" copiedLabel="Upload link copied" />
      <ModalButton
        label={`Add a draft for ${name.split(" ")[0]}`}
        title={`Add a draft for ${name}`}
        className={`btn btn-sm ${compact ? "" : "mt-3 flex w-fit"}`}
      >
        <TeamDraftForm campaignId={campaignId} fixed={fixed} sample={sample} />
      </ModalButton>
    </div>
  );
}

/** "Posting on TikTok @handle and Instagram @handle". */
function PostingOn({ platforms, creator }: { platforms: DraftPlatform[]; creator?: Creator }) {
  const handle = (p: DraftPlatform) => (p === "TikTok" ? creator?.tiktok : p === "Instagram" ? creator?.instagram : undefined);
  return (
    <p className="mt-1 text-[13px] text-secondary">
      <span className="font-bold text-fb-black">Posting on </span>
      {platforms.map((p, i) => (
        <span key={p}>
          {i > 0 && (i === platforms.length - 1 ? " and " : ", ")}
          {p}
          {handle(p) ? ` @${handle(p)}` : ""}
        </span>
      ))}
    </p>
  );
}

export function DraftsBody({
  lanes,
  partner,
  team,
  showFees = false,
}: {
  lanes: Lane[];
  partner?: { reviewEndpoint: string };
  /** Partner view: show each creator's cost (only when the campaign shows rates). The team always sees it. */
  showFees?: boolean;
  team?: { uploadUrls: Record<string, string>; tools: React.ReactNode; campaignId: string; sample: boolean };
}) {
  // Drafts still to decide on come first; approved ones drop below; creators with nothing yet sit at the end.
  const toReview = lanes.filter((l) => l.drafts.length && l.drafts[0].status !== "Approved");
  const approved = lanes.filter((l) => l.drafts[0]?.status === "Approved");
  const waiting = lanes.filter((l) => !l.drafts.length);
  const props = { partner, team, showFees };

  return (
    <>
      {team?.tools}
      <section>
        <h2 className="section-title">{toReview.length ? "To review" : "The drafts"}</h2>
        {partner && lanes.some((l) => l.drafts.some((d) => d.status === "Pending review")) && (
          <p className="-mt-1 mb-3.5 max-w-md text-sm text-secondary">
            Watch each draft, then approve it or request a change. Creators see your notes and send a new version.
          </p>
        )}

        {lanes.length ? (
          <MaybeSelectable team={team} ids={lanes.flatMap((l) => l.drafts.map((d) => d.id))}>
            {toReview.length ? (
              <LaneGrid lanes={toReview} {...props} />
            ) : (
              <div className="card">
                <p className="empty">
                  {approved.length ? "Nothing waiting for review. Every draft sent so far is approved." : "No drafts yet."}
                </p>
              </div>
            )}

            {approved.length > 0 && (
              <div>
                <h2 className="section-title">Approved</h2>
                <p className="-mt-1 text-sm text-secondary">
                  {approved.length} {approved.length === 1 ? "creator's draft is" : "creators' drafts are"} approved and ready to post.
                </p>
                <LaneGrid lanes={approved} {...props} />
              </div>
            )}
          </MaybeSelectable>
        ) : (
          <div className="card">
            <p className="empty">
              {team
                ? "Drafts show up here once creators are approved and send them, or when you add one with “Add a draft”."
                : "Drafts show up here once creators are approved and start uploading."}
            </p>
          </div>
        )}

        {waiting.length > 0 && (
          <div>
            <h2 className="section-title">Waiting on drafts</h2>
            <ul className="card py-1">
              {waiting.map(({ assignment: a }) => {
                const name = a.creator?.name ?? "Creator";
                return (
                  <li key={a.id} className="border-b border-line py-4 last:border-b-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                      <div>
                        <p className="font-display text-[15px] font-bold tracking-[0.02em]">{name}</p>
                        <CreatorMeta assignment={a} showCost={!team && showFees} showCpm={Boolean(team) || showFees} />
                      </div>
                      <span className="text-xs text-muted">Hasn&apos;t sent a draft yet</span>
                    </div>
                    {team && (
                      <div className="mt-3">
                        <TeamLaneControls
                          assignment={a}
                          name={name}
                          uploadUrl={team.uploadUrls[a.id]}
                          campaignId={team.campaignId}
                          sample={team.sample}
                          compact
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {team && <p className="mt-3 text-xs text-muted">To take someone off the campaign, select them on the Creators tab and remove them.</p>}
          </div>
        )}
      </section>
    </>
  );
}

function LaneGrid({
  lanes,
  partner,
  team,
  showFees,
}: {
  lanes: Lane[];
  partner?: { reviewEndpoint: string };
  team?: { uploadUrls: Record<string, string>; campaignId: string; sample: boolean };
  showFees: boolean;
}) {
  return (
    <ul className="mt-3.5 grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
      {lanes.map(({ assignment: a, drafts }) => {
        const name = a.creator?.name ?? "Creator";
        const teamControls = team && (
          <TeamLaneControls
            assignment={a}
            name={name}
            uploadUrl={team.uploadUrls[a.id]}
            campaignId={team.campaignId}
            sample={team.sample}
          />
        );
        // The team edits the fee in its own box, so the read-only cost is for partners.
        const meta = <CreatorMeta assignment={a} showCost={!team && showFees} showCpm={Boolean(team) || showFees} />;

        // Several versions: the creator gets a full-width row with every version side by side.
        if (drafts.length > 1) {
          return (
            <li key={a.id} className="card col-span-full">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                <div>
                  <h3 className="font-display text-[17px] font-bold tracking-[0.02em]">{name}</h3>
                  {meta}
                </div>
                <span className="text-xs text-muted">
                  {drafts.length} versions, newest first
                  {drafts.slice(1).some((d) => d.status === "Pending review") && (
                    <span className="font-bold text-fb-black"> · an earlier version is still awaiting review</span>
                  )}
                </span>
              </div>
              <ol className="mt-4 flex gap-5 overflow-x-auto pb-3 snap-x">
                {drafts.map((d, i) => (
                  <li key={d.id} className="relative w-[280px] shrink-0 snap-start">
                    {team && <SelectBox id={d.id} label={`${name}'s version ${d.version}`} />}
                    <VersionCard draft={d} latest={i === 0} partner={partner} teamCampaignId={team?.campaignId} creatorName={name} />
                  </li>
                ))}
              </ol>
              {teamControls && <div className="mt-2 border-t border-line pt-3.5">{teamControls}</div>}
            </li>
          );
        }

        const d = drafts[0];
        return (
          <li key={a.id} className="card relative">
            {team && d && <SelectBox id={d.id} label={`${name}'s version ${d.version}`} />}
            <article>
              <VersionCard draft={d} name={name} meta={meta} partner={partner} teamCampaignId={team?.campaignId} />
              {teamControls && <div className="mt-4 border-t border-line pt-3.5">{teamControls}</div>}
            </article>
          </li>
        );
      })}
    </ul>
  );
}

/** On the team page, drafts can be selected and deleted together. */
function MaybeSelectable({ team, ids, children }: { team?: { campaignId: string }; ids: string[]; children: React.ReactNode }) {
  if (!team) return <>{children}</>;
  return (
    <BulkSelectProvider>
      <BulkBar
        allIds={ids}
        noun={["draft", "drafts"]}
        action="Delete drafts"
        confirmText="Delete {items}? They disappear for the team and partners. Videos uploaded to the hub are deleted for good; linked videos stay where they are."
        endpoint={`/api/campaigns/${team.campaignId}/drafts`}
        bodyKey="draftIds"
      />
      {children}
    </BulkSelectProvider>
  );
}
