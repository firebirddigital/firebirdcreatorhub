import { draftSource } from "@/lib/draft-links";
import { shortDate } from "@/lib/format";
import type { Assignment, Draft, DraftStatus } from "@/lib/types";
import { HeroFigure, HeroStats } from "./Shell";
import { ReviewControls } from "./ReviewControls";
import { TeamDraftForm } from "./TeamDraftForm";
import { CopyButton } from "./TeamControls";

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

const STATUS: Record<DraftStatus, { label: string; className: string }> = {
  "Pending review": { label: "Awaiting review", className: "border-2 border-fb-black bg-fb-white" },
  Approved: { label: "Approved", className: "bg-fb-red text-fb-white" },
  "Changes requested": { label: "Changes requested", className: "bg-fb-black text-fb-white" },
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
        className="absolute inset-0 h-full w-full object-contain bg-fb-black"
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
        className="absolute inset-0 h-full w-full border-0 bg-fb-black"
      />
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-start justify-end gap-3 p-5 text-fb-white">
      <span className="text-sm text-fb-white/75">This draft is on {source.label}.</span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="subtitle bg-fb-red px-5 py-3 text-sm hover:bg-fb-white hover:text-fb-black transition-colors"
      >
        Open draft
      </a>
    </div>
  );
}

export function DraftsBody({
  lanes,
  partner,
  team,
}: {
  lanes: Lane[];
  partner?: { reviewEndpoint: string };
  team?: { uploadUrls: Record<string, string>; tools: React.ReactNode; addDraft: React.ReactNode; campaignId: string; sample: boolean };
}) {
  return (
    <>
      {team?.tools}
      {team && (
        <section aria-label="Add a draft" className="border-2 border-fb-black p-6 max-sm:p-4">
          <h2 className="headline text-2xl">Add a draft</h2>
          <p className="mt-1 mb-5 max-w-prose text-sm">
            Got a draft by email or text? Add it here for any creator, even one who isn't on this campaign yet.
          </p>
          {team.addDraft}
        </section>
      )}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="headline text-3xl">The drafts</h2>
          {partner && lanes.some((l) => l.drafts[0]?.status === "Pending review") && (
            <p className="max-w-md text-sm">
              Watch each draft, then approve it or request a change. Creators see your notes and send a new version.
            </p>
          )}
        </div>

        {lanes.length ? (
          <ul className="mt-8 grid gap-x-8 gap-y-14 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
            {lanes.map(({ assignment: a, drafts }) => {
              const d = drafts[0];
              return (
                <li key={a.id}>
                  <article>
                    <div className="relative aspect-[9/16] bg-fb-black overflow-hidden">
                      {d?.videoUrl ? (
                        <DraftPlayer url={d.videoUrl} />
                      ) : (
                        <div className="absolute inset-0 flex flex-col justify-end p-5 text-fb-white">
                          <span className="subtitle text-xs">{d ? `Version ${d.version}` : "Waiting on draft"}</span>
                          <span className="mt-2 text-sm text-fb-white/75">
                            {d ? "Sample draft. Real uploads play here." : "The creator hasn't uploaded yet."}
                          </span>
                        </div>
                      )}
                      {d && (
                        <span
                          className={`absolute left-0 top-0 px-2.5 py-1 text-xs font-bold ${STATUS[d.status].className}`}
                        >
                          {STATUS[d.status].label}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-baseline justify-between gap-3">
                      <h3 className="subtitle text-xl truncate">{a.creator?.name ?? "Creator"}</h3>
                      {d && (
                        <span className="text-sm shrink-0">
                          v{d.version}, {shortDate(d.submittedAt)}
                        </span>
                      )}
                    </div>
                    {(d?.submittedBy || (d?.videoUrl && !draftSource(d.videoUrl).hosted)) && (
                      <p className="mt-1 text-xs">
                        {d.submittedBy && <>Added by {d.submittedBy}. </>}
                        {d.videoUrl && !draftSource(d.videoUrl).hosted && (
                          <a href={d.videoUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                            Open on {draftSource(d.videoUrl).label}
                          </a>
                        )}
                      </p>
                    )}
                    {d?.caption && <p className="mt-2 text-sm border-l-4 border-fb-black pl-3">{d.caption}</p>}
                    {d?.partnerComment && (
                      <blockquote className="mt-3 border-l-4 border-fb-red pl-3 text-sm">
                        {d.partnerComment}
                        {d.reviewedBy && <footer className="mt-1 text-xs">{d.reviewedBy}</footer>}
                      </blockquote>
                    )}

                    {drafts.length > 1 && (
                      <details className="mt-3 text-sm">
                        <summary className="cursor-pointer underline underline-offset-4">
                          Earlier versions ({drafts.length - 1})
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {drafts.slice(1).map((old) => (
                            <li key={old.id} className="border-b border-fb-black/20 pb-2">
                              <span className="font-bold">v{old.version}</span> {STATUS[old.status].label.toLowerCase()}
                              {old.videoUrl && (
                                <a href={old.videoUrl} target="_blank" rel="noreferrer" className="ml-2 underline">
                                  Watch
                                </a>
                              )}
                              {old.partnerComment && <p className="mt-1">{old.partnerComment}</p>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    <div className="mt-4">
                      {partner && d && (
                        <ReviewControls
                          endpoint={partner.reviewEndpoint}
                          kind="draft"
                          recordId={d.id}
                          decided={d.status !== "Pending review"}
                        />
                      )}
                      {team && (
                        <>
                          <CopyButton
                            text={team.uploadUrls[a.id]}
                            label="Copy draft upload link"
                            copiedLabel="Upload link copied"
                          />
                          <details className="mt-3">
                            <summary className="cursor-pointer text-sm font-bold underline underline-offset-4 hover:text-fb-red">
                              Add a draft for {a.creator?.name?.split(" ")[0] ?? "them"}
                            </summary>
                            <div className="mt-4">
                              <TeamDraftForm
                                campaignId={team.campaignId}
                                fixed={{ assignmentId: a.id, name: a.creator?.name ?? "Creator" }}
                                sample={team.sample}
                              />
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-8 max-w-prose">
            {team
              ? "Drafts show up here once creators are approved and send them, or when you add one above."
              : "Drafts show up here once creators are approved and start uploading."}
          </p>
        )}
      </section>
    </>
  );
}
