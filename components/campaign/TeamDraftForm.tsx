"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DRAFT_PLATFORMS, type AssignmentStatus, type DraftPlatform } from "@/lib/types";
import { choiceReady, DraftSourceInput, emptyChoice, resolveDraft, UploadProgress } from "../DraftSourceInput";

type Handles = { instagram?: string; tiktok?: string };
type Who =
  | ({ kind: "assignment"; assignmentId: string; name: string } & Handles)
  | ({ kind: "creator"; creatorId: string; name: string } & Handles)
  | { kind: "new"; name: string; instagram: string; tiktok: string };

export interface PickerCreator {
  id: string;
  name: string;
  instagram?: string;
  tiktok?: string;
  /** Set when the creator is already on this campaign. */
  assignment?: { id: string; status: AssignmentStatus };
}

/**
 * Team form for adding a draft on a creator's behalf: someone on the campaign, someone from the
 * roster, or a brand new creator. With `fixed`, it's the per-creator version with no picker.
 */
export function TeamDraftForm({
  campaignId,
  creators = [],
  fixed,
  sample,
}: {
  campaignId: string;
  creators?: PickerCreator[];
  fixed?: { assignmentId: string; name: string } & Handles;
  sample: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [who, setWho] = useState<Who | undefined>(
    fixed ? { kind: "assignment", ...fixed } : undefined,
  );
  const [platforms, setPlatforms] = useState<DraftPlatform[]>([]);
  const [choice, setChoice] = useState(emptyChoice);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const options = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return [];
    return creators
      .filter((c) => [c.name, c.instagram, c.tiktok].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => Number(Boolean(b.assignment)) - Number(Boolean(a.assignment)))
      .slice(0, 8);
  }, [creators, query]);

  const whoReady = who && (who.kind !== "new" || who.name.trim());
  const ready = Boolean(whoReady && choiceReady(choice) && platforms.length);
  const busy = sample || saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!who || !ready) return;
    setMessage(undefined);
    setSaving(true);
    try {
      if (choice.mode === "file") setProgress(0);
      const videoUrl = await resolveDraft(choice, {
        path: `drafts/team/${campaignId}/${Date.now()}`,
        uploadUrl: `/api/campaigns/${campaignId}/drafts/upload`,
        onProgress: setProgress,
      });
      const res = await fetch(`/api/campaigns/${campaignId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl,
          caption,
          platforms,
          ...(who.kind === "assignment" ? { assignmentId: who.assignmentId } : {}),
          ...(who.kind === "creator" ? { creatorId: who.creatorId } : {}),
          ...(who.kind === "new" ? { newCreator: { name: who.name, instagram: who.instagram, tiktok: who.tiktok } } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        version?: number;
        createdCreator?: boolean;
        addedToCampaign?: boolean;
        platformsSaved?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Saving the draft failed.");
      const extras = [
        data.createdCreator ? "added them to the roster" : "",
        data.addedToCampaign ? "added them to this campaign as Approved" : "",
      ].filter(Boolean);
      setMessage({
        text: `Saved as ${who.name.trim()}'s version ${data.version}, waiting for partner review.${
          extras.length ? ` Also ${extras.join(" and ")}.` : ""
        }${data.platformsSaved === false ? " The platforms weren't saved: add a single line text field called “Platforms” to the Drafts table in Airtable." : ""}`,
        error: data.platformsSaved === false,
      });
      setChoice(emptyChoice());
      setCaption("");
      setPlatforms([]);
      if (!fixed) {
        setWho(undefined);
        setQuery("");
      }
      router.refresh();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setProgress(undefined);
      setSaving(false);
    }
  }

  const field = "field";

  return (
    <form onSubmit={submit} className="space-y-5">
      {!fixed && (
        <div>
          {who ? (
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <span className="field-label mb-0">Creator</span>
              <span className="font-display text-[15px] font-bold tracking-[0.02em]">{who.kind === "new" ? who.name || "New creator" : who.name}</span>
              <span className="text-xs text-muted">
                {who.kind === "assignment"
                  ? "On this campaign"
                  : who.kind === "creator"
                    ? "From the roster. They'll be added to this campaign as Approved."
                    : "New. They'll be added to the roster and this campaign as Approved."}
              </span>
              <button
                type="button"
                onClick={() => setWho(undefined)}
                disabled={busy}
                className="btn btn-quiet btn-sm"
              >
                Change
              </button>
            </div>
          ) : (
            <label className="block">
              <span className="field-label">Whose draft is it?</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or handle"
                disabled={busy}
                className={field}
              />
            </label>
          )}
          {!who && query.trim() && (
            <ul className="mt-1.5 divide-y divide-line overflow-hidden rounded-control border border-line-strong bg-surface shadow-lift">
              {options.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setWho(
                        c.assignment
                          ? { kind: "assignment", assignmentId: c.assignment.id, name: c.name, instagram: c.instagram, tiktok: c.tiktok }
                          : { kind: "creator", creatorId: c.id, name: c.name, instagram: c.instagram, tiktok: c.tiktok },
                      )
                    }
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-wash-neutral"
                  >
                    <span className="font-bold">{c.name}</span>
                    <span className="text-[13px] text-secondary truncate">
                      {[c.instagram && `@${c.instagram}`, c.tiktok && c.tiktok !== c.instagram && `@${c.tiktok}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted">
                      {c.assignment ? `On campaign · ${c.assignment.status}` : "Roster"}
                    </span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => {
                    const q = query.trim();
                    const handle = q.startsWith("@") ? q.slice(1) : "";
                    setWho({ kind: "new", name: handle ? "" : q, instagram: handle, tiktok: "" });
                  }}
                  className="w-full px-3 py-2.5 text-left font-bold text-fb-red transition-colors hover:bg-wash"
                >
                  + Add “{query.trim()}” as a new creator
                </button>
              </li>
            </ul>
          )}
          {who?.kind === "new" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="field-label">Name</span>
                <input
                  value={who.name}
                  onChange={(e) => setWho({ ...who, name: e.target.value })}
                  disabled={busy}
                  required
                  className={field}
                />
              </label>
              <label className="block">
                <span className="field-label">Instagram handle</span>
                <input
                  value={who.instagram}
                  onChange={(e) => setWho({ ...who, instagram: e.target.value })}
                  placeholder="@"
                  disabled={busy}
                  className={field}
                />
              </label>
              <label className="block">
                <span className="field-label">TikTok handle</span>
                <input
                  value={who.tiktok}
                  onChange={(e) => setWho({ ...who, tiktok: e.target.value })}
                  placeholder="@"
                  disabled={busy}
                  className={field}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <fieldset>
        <legend className="field-label">Where will it be posted?</legend>
        <div className="flex flex-wrap gap-2">
          {DRAFT_PLATFORMS.map((p) => {
            const handle = p === "TikTok" ? who?.tiktok : p === "Instagram" ? who?.instagram : undefined;
            const on = platforms.includes(p);
            return (
              <label
                key={p}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-control border px-3 py-2 shadow-tile transition-colors has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-55 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-fb-red ${
                  on ? "border-fb-red bg-wash" : "border-line-strong bg-surface hover:bg-wash-neutral"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setPlatforms((cur) => (on ? cur.filter((x) => x !== p) : DRAFT_PLATFORMS.filter((x) => x === p || cur.includes(x))))}
                  disabled={busy}
                  className="accent-fb-red size-4 focus-visible:outline-none"
                />
                <span className="text-[13px] font-bold">{p}</span>
                {handle && <span className="text-xs text-muted">@{handle.replace(/^@/, "")}</span>}
              </label>
            );
          })}
        </div>
      </fieldset>

      <DraftSourceInput value={choice} onChange={setChoice} disabled={busy} audience="team" />

      <label className="block">
        <span className="field-label">Caption they plan to post</span>
        <textarea
          rows={2}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={busy}
          className="field"
        />
      </label>

      <UploadProgress progress={progress} />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-4">
        <button
          disabled={busy || !ready}
          className="btn btn-primary"
        >
          {progress !== undefined ? "Uploading" : saving ? "Saving" : "Add draft"}
        </button>
        <span className="text-xs text-muted">Saved as the creator's next version, marked “Added by Firebird team”.</span>
      </div>

      {sample && <p className="banner">Adding drafts turns on once Airtable is connected.</p>}
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-fb-red font-bold" : "text-secondary"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
