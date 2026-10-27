"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { compact } from "@/lib/format";
import type { AssignmentStatus, Creator, Stage } from "@/lib/types";

const STATUSES: AssignmentStatus[] = ["Proposed", "Approved", "Changes requested", "Declined"];

async function call(url: string, method: string, body?: object) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!res.ok) throw new Error(data.error ?? "That didn't work. Try again.");
  return data;
}

export function CopyButton({ text, label, copiedLabel = "Copied" }: { text: string; label: string; copiedLabel?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="text-sm font-bold underline underline-offset-4 hover:text-fb-red"
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

interface NewCreatorDraft {
  name: string;
  instagram: string;
  tiktok: string;
  tags: string[];
  rate: string;
  email: string;
  location: string;
}

const EMPTY_NEW: NewCreatorDraft = { name: "", instagram: "", tiktok: "", tags: [], rate: "", email: "", location: "" };

/** Adds a brand new creator to the Creators database and this campaign in one go. */
function NewCreatorForm({
  value: v,
  onChange,
  allTags,
  busy,
  onCancel,
  onSubmit,
}: {
  value: NewCreatorDraft;
  onChange: (v: NewCreatorDraft) => void;
  allTags: string[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const [tagDraft, setTagDraft] = useState("");
  const set = (patch: Partial<NewCreatorDraft>) => onChange({ ...v, ...patch });
  const toggleTag = (t: string) => set({ tags: v.tags.includes(t) ? v.tags.filter((x) => x !== t) : [...v.tags, t] });
  const addTypedTag = () => {
    const t = tagDraft.trim();
    if (t && !v.tags.includes(t)) set({ tags: [...v.tags, t] });
    setTagDraft("");
  };
  const field = "mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 outline-none focus:border-fb-red";
  const canSave = v.name.trim() && !busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSubmit();
      }}
      className="mt-4 border-2 border-fb-red p-5 space-y-4"
    >
      <div>
        <h3 className="subtitle text-lg">New creator</h3>
        <p className="text-xs">Saved to the Creators database and added to this campaign. If someone already has this handle, we use them instead.</p>
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <label>
          <span className="text-xs font-bold">Name</span>
          <input required autoFocus value={v.name} onChange={(e) => set({ name: e.target.value })} className={field} />
        </label>
        <label>
          <span className="text-xs font-bold">TikTok handle</span>
          <input value={v.tiktok} onChange={(e) => set({ tiktok: e.target.value })} placeholder="@" className={field} />
        </label>
        <label>
          <span className="text-xs font-bold">Instagram handle</span>
          <input value={v.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="@" className={field} />
        </label>
        <label>
          <span className="text-xs font-bold">Rate per post ($)</span>
          <input
            inputMode="numeric"
            value={v.rate}
            onChange={(e) => set({ rate: e.target.value.replace(/[^\d]/g, "") })}
            className={field}
          />
        </label>
        <label>
          <span className="text-xs font-bold">Email (optional)</span>
          <input type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} className={field} />
        </label>
        <label>
          <span className="text-xs font-bold">Location (optional)</span>
          <input value={v.location} onChange={(e) => set({ location: e.target.value })} className={field} />
        </label>
      </div>
      <div>
        <span className="text-xs font-bold">Tags</span>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {[...new Set([...allTags, ...v.tags])].map((t) => {
            const on = v.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                aria-pressed={on}
                className={`px-2 py-0.5 text-xs font-bold border ${
                  on ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-black hover:bg-fb-black hover:text-fb-white"
                }`}
              >
                {t}
              </button>
            );
          })}
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTypedTag();
              }
            }}
            onBlur={addTypedTag}
            placeholder="+ new tag"
            aria-label="Add a new tag"
            className="w-28 border-b-2 border-fb-black bg-transparent py-0.5 text-xs outline-none focus:border-fb-red"
          />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          disabled={!canSave}
          className="subtitle bg-fb-red text-fb-white px-6 py-3 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
        >
          {busy ? "Adding" : "Add to database and campaign"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm underline underline-offset-4">
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Team toolbar on the Creators tab: add from the roster, pull stats, move stage, share. */
export function RosterTools({
  campaignId,
  roster,
  onCampaign,
  current,
  shareUrl,
  sample,
}: {
  campaignId: string;
  roster: Pick<Creator, "id" | "name" | "instagram" | "tiktok" | "instagramFollowers" | "tiktokFollowers" | "tags">[];
  onCampaign: string[];
  current: Stage;
  shareUrl?: string;
  sample: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [newCreator, setNewCreator] = useState<NewCreatorDraft>();
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const allTags = useMemo(() => [...new Set(roster.flatMap((c) => c.tags))].sort(), [roster]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((c) => !onCampaign.includes(c.id))
      .filter(
        (c) =>
          !q ||
          [c.name, c.instagram, c.tiktok, ...c.tags].some((v) => v?.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [roster, onCampaign, query]);

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key);
    setMessage(undefined);
    try {
      setMessage({ text: await fn() });
      router.refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    } finally {
      setBusy(undefined);
    }
  }

  const nextStage: Stage | undefined = current === "creators" ? "drafts" : current === "drafts" ? "live" : undefined;

  return (
    <section aria-label="Roster tools" className="border-2 border-fb-black p-6 max-sm:p-4 space-y-5">
      <div>
        <label className="block">
          <span className="text-sm font-bold">Add creators to this campaign</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the roster by name, handle or niche"
            disabled={sample}
            className="mt-2 w-full border-b-2 border-fb-black bg-transparent py-2.5 outline-none focus:border-fb-red disabled:opacity-50"
          />
        </label>
        {query && (
          <ul className="mt-2 divide-y divide-fb-black/15 border-x-2 border-b-2 border-fb-black">
            {options.length ? (
              options.map((c) => {
                const on = picked.includes(c.id);
                return (
                  <li key={c.id}>
                    <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-fb-black/5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                        className="accent-fb-red size-4"
                      />
                      <span className="font-bold">{c.name}</span>
                      <span className="text-sm truncate">{c.tags.join(", ")}</span>
                      <span className="ml-auto figure text-sm">{compact(c.instagramFollowers + c.tiktokFollowers)}</span>
                    </label>
                  </li>
                );
              })
            ) : (
              <li className="px-3 py-2.5 text-sm">No one on the roster matches.</li>
            )}
            <li>
              <button
                type="button"
                onClick={() => {
                  const q = query.trim();
                  const handle = q.startsWith("@") ? q.slice(1) : "";
                  setNewCreator({ ...EMPTY_NEW, name: handle ? "" : q, tiktok: handle });
                  setQuery("");
                }}
                disabled={sample}
                className="w-full px-3 py-2.5 text-left font-bold hover:bg-fb-black/5"
              >
                + Add “{query.trim()}” as a new creator
              </button>
            </li>
          </ul>
        )}
        {!query && !newCreator && (
          <button
            type="button"
            onClick={() => setNewCreator({ ...EMPTY_NEW })}
            disabled={sample}
            className="mt-3 text-sm font-bold underline underline-offset-4 hover:text-fb-red disabled:opacity-50"
          >
            Add a new creator
          </button>
        )}
        {newCreator && (
          <NewCreatorForm
            value={newCreator}
            onChange={setNewCreator}
            allTags={allTags}
            busy={busy === "new"}
            onCancel={() => setNewCreator(undefined)}
            onSubmit={() =>
              run("new", async () => {
                const d = (await call(`/api/campaigns/${campaignId}/roster`, "POST", {
                  newCreator: {
                    ...newCreator,
                    tags: newCreator.tags,
                    rate: newCreator.rate ? Number(newCreator.rate) : undefined,
                  },
                })) as { added?: number; newCreator?: { created: boolean; name: string } };
                setNewCreator(undefined);
                const who = d.newCreator?.name ?? newCreator.name;
                if (d.newCreator && !d.newCreator.created) {
                  return d.added
                    ? `${who} was already in the database (same handle), so we added them to this campaign as Proposed.`
                    : `${who} is already in the database and on this campaign.`;
                }
                return `Added ${who} to the Creators database and to this campaign as Proposed. Click Refresh creator stats to pull their followers.`;
              })
            }
          />
        )}
        {picked.length > 0 && (
          <button
            onClick={() =>
              run("add", async () => {
                const d = await call(`/api/campaigns/${campaignId}/roster`, "POST", { creatorIds: picked });
                setPicked([]);
                setQuery("");
                return `Added ${d.added} to the campaign as Proposed.`;
              })
            }
            disabled={busy === "add"}
            className="mt-3 subtitle bg-fb-red text-fb-white px-6 py-3 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
          >
            {busy === "add" ? "Adding" : `Add ${picked.length} ${picked.length === 1 ? "creator" : "creators"}`}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <button
          onClick={() =>
            run("stats", async () => {
              const d = await call(`/api/campaigns/${campaignId}/creator-stats`, "POST");
              return `Updated followers and average views for ${d.updated} of ${d.requested} creators.`;
            })
          }
          disabled={sample || busy === "stats"}
          className="font-bold underline underline-offset-4 hover:text-fb-red disabled:opacity-50 disabled:no-underline"
        >
          {busy === "stats" ? "Pulling creator stats (up to a minute)" : "Refresh creator stats"}
        </button>
        {nextStage && (
          <button
            onClick={() =>
              run("stage", async () => {
                await call(`/api/campaigns/${campaignId}/stage`, "POST", { stage: nextStage });
                return `Moved to ${nextStage === "drafts" ? "Drafts" : "Live"}. The share link now opens there.`;
              })
            }
            disabled={sample || busy === "stage"}
            className="font-bold underline underline-offset-4 hover:text-fb-red disabled:opacity-50 disabled:no-underline"
          >
            Move campaign to {nextStage === "drafts" ? "Drafts" : "Live"}
          </button>
        )}
        {shareUrl ? (
          <CopyButton text={shareUrl} label="Copy partner share link" copiedLabel="Share link copied" />
        ) : (
          <span>Tick “Sharing Enabled” on this campaign in Airtable to get a partner link.</span>
        )}
      </div>

      {sample && <p className="text-sm">These tools turn on once Airtable and Apify are connected.</p>}
      {message && (
        <p role="status" className={`text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}

/** Per-creator controls for the team: status, fee and the creator's private upload link. */
export function AssignmentControls({
  campaignId,
  assignmentId,
  status,
  fee,
  uploadUrl,
}: {
  campaignId: string;
  assignmentId: string;
  status: AssignmentStatus;
  fee?: number;
  uploadUrl: string;
}) {
  const router = useRouter();
  const [feeInput, setFeeInput] = useState(fee ? String(fee) : "");
  const [error, setError] = useState<string>();

  async function patch(body: object) {
    setError(undefined);
    try {
      await call(`/api/campaigns/${campaignId}/roster`, "PATCH", { assignmentId, ...body });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-3">
        <label className="flex-1">
          <span className="text-xs font-bold">Status</span>
          <select
            value={status}
            onChange={(e) => patch({ status: e.target.value })}
            className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 font-bold outline-none focus:border-fb-red"
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="w-28">
          <span className="text-xs font-bold">Fee ($)</span>
          <input
            inputMode="numeric"
            value={feeInput}
            onChange={(e) => setFeeInput(e.target.value.replace(/[^\d]/g, ""))}
            onBlur={() => {
              const next = feeInput ? Number(feeInput) : null;
              if (next !== (fee ?? null)) patch({ fee: next });
            }}
            className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 font-bold outline-none focus:border-fb-red"
          />
        </label>
      </div>
      {status === "Approved" ? (
        <CopyButton text={uploadUrl} label="Copy draft upload link" copiedLabel="Upload link copied" />
      ) : (
        <p className="text-xs">The draft upload link appears once this creator is approved.</p>
      )}
      {error && <p className="text-fb-red font-bold">{error}</p>}
    </div>
  );
}
