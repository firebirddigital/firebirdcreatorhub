import { shortDate } from "@/lib/format";
import type { Assignment, Draft, DraftStatus } from "@/lib/types";
import { HeroFigure, HeroStats } from "./Shell";
import { ReviewControls } from "./ReviewControls";
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

export function DraftsBody({
  lanes,
  partner,
  team,
}: {
  lanes: Lane[];
  partner?: { reviewEndpoint: string };
  team?: { uploadUrls: Record<string, string>; tools: React.ReactNode };
}) {
  return (
    <>
      {team?.tools}
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
                        <video
                          src={d.videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="absolute inset-0 h-full w-full object-contain bg-fb-black"
                        />
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
                        <CopyButton
                          text={team.uploadUrls[a.id]}
                          label="Copy draft upload link"
                          copiedLabel="Upload link copied"
                        />
                      )}
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-8 max-w-prose">
            Drafts show up here once creators are approved and start uploading.
          </p>
        )}
      </section>
    </>
  );
}
