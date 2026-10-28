"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { compact } from "@/lib/format";
import { profileFromUrl } from "@/lib/social";
import { ModalButton } from "./Modal";
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

/** Outlined button for team actions. */
export const BUTTON =
  "subtitle border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-fb-black";
/** Filled red button for the main next step. */
export const BUTTON_PRIMARY =
  "subtitle border-2 border-fb-red bg-fb-red text-fb-white px-5 py-2.5 text-sm hover:bg-fb-black hover:border-fb-black transition-colors disabled:opacity-50";

export function CopyButton({
  text,
  label,
  copiedLabel = "Copied",
  variant = "link",
}: {
  text: string;
  label: string;
  copiedLabel?: string;
  variant?: "link" | "button";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className={variant === "button" ? BUTTON : "text-sm font-bold underline underline-offset-4 hover:text-fb-red"}
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
  /** Profile link pasted at the top of the form; looked up for the name and stats. */
  link: string;
  /** True while the name is still the one we filled in (so a lookup may replace it). */
  nameAuto: boolean;
  instagramFollowers?: number;
  tiktokFollowers?: number;
  avgViews?: number;
}

const EMPTY_NEW: NewCreatorDraft = {
  name: "",
  instagram: "",
  tiktok: "",
  tags: [],
  rate: "",
  email: "",
  location: "",
  link: "",
  nameAuto: true,
};

interface Lookup {
  platform: "instagram" | "tiktok";
  handle: string;
  name?: string;
  followers?: number;
  avgViews?: number;
  found: boolean;
  existing?: { id: string; name: string };
}

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
  const [lookup, setLookup] = useState<{ state: "loading" | "done" | "error"; handle: string; result?: Lookup; error?: string }>();
  const latest = useRef(v);
  latest.current = v;
  const lookupSeq = useRef(0);
  const set = (patch: Partial<NewCreatorDraft>) => onChange({ ...v, ...patch });

  /** Fills the handle straight away, then the display name and stats once the lookup returns. */
  async function lookUp(link: string) {
    const profile = profileFromUrl(link);
    if (!profile) return;
    const seq = ++lookupSeq.current;
    const cur = latest.current;
    const handleField = profile.platform === "tiktok" ? "tiktok" : "instagram";
    onChange({
      ...cur,
      link,
      [handleField]: profile.handle,
      ...(cur.nameAuto || !cur.name.trim() ? { name: cur.name.trim() || profile.handle, nameAuto: true } : {}),
    });
    setLookup({ state: "loading", handle: profile.handle });
    try {
      const res = await fetch("/api/creators/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: link }),
      });
      const data = (await res.json().catch(() => ({}))) as Lookup & { error?: string };
      if (seq !== lookupSeq.current) return; // a newer link was pasted
      if (!res.ok) {
        setLookup({ state: "error", handle: profile.handle, error: data.error });
        return;
      }
      const now = latest.current;
      onChange({
        ...now,
        ...(data.name && now.nameAuto ? { name: data.name } : {}),
        ...(data.followers
          ? data.platform === "tiktok"
            ? { tiktokFollowers: data.followers }
            : { instagramFollowers: data.followers }
          : {}),
        ...(data.avgViews ? { avgViews: now.avgViews ?? data.avgViews } : {}),
      });
      setLookup({ state: "done", handle: profile.handle, result: data });
    } catch {
      if (seq === lookupSeq.current) setLookup({ state: "error", handle: profile.handle });
    }
  }

  // A profile link passed in from the search box is looked up as soon as the form opens.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && v.link) {
      started.current = true;
      lookUp(v.link);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      <label className="block">
        <span className="text-xs font-bold">Profile link</span>
        <span className="block text-xs">Paste their TikTok or Instagram profile link and we&apos;ll fill in the name, handle and stats. Paste the other one too if they have both.</span>
        <input
          autoFocus
          inputMode="url"
          value={v.link}
          onChange={(e) => {
            set({ link: e.target.value });
            if (profileFromUrl(e.target.value)) lookUp(e.target.value);
          }}
          placeholder="tiktok.com/@name or instagram.com/name"
          className={field}
        />
        {v.link.trim() && !profileFromUrl(v.link) && (
          <span className="mt-1 block text-xs text-fb-red font-bold">
            That isn&apos;t a profile link. Use tiktok.com/@name or instagram.com/name (Instagram post links don&apos;t include the handle).
          </span>
        )}
        {lookup && (
          <span role="status" className="mt-1 block text-xs">
            {lookup.state === "loading" && <>Looking up @{lookup.handle}. This can take up to a minute; you can keep filling in the rest.</>}
            {lookup.state === "error" && <>Couldn&apos;t look up @{lookup.handle}{lookup.error ? `: ${lookup.error}` : ""}. Type the name and save anyway.</>}
            {lookup.state === "done" && lookup.result && (
              <>
                {lookup.result.found ? (
                  <>
                    Found <span className="font-bold">{lookup.result.name ?? `@${lookup.handle}`}</span>
                    {lookup.result.followers ? `, ${compact(lookup.result.followers)} followers` : ""}
                    {lookup.result.avgViews ? `, ${compact(lookup.result.avgViews)} median views (last 10 posts)` : ""}.
                  </>
                ) : (
                  <>Couldn&apos;t read @{lookup.handle}&apos;s profile (it may be private). Type the name and save anyway.</>
                )}
                {lookup.result.existing && (
                  <span className="block font-bold">
                    Already in the database as {lookup.result.existing.name}. Saving adds them to this campaign without a duplicate.
                  </span>
                )}
              </>
            )}
          </span>
        )}
      </label>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <label>
          <span className="text-xs font-bold">Name</span>
          <input required value={v.name} onChange={(e) => set({ name: e.target.value, nameAuto: false })} className={field} />
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

/** Team toolbar on the Creators and Drafts tabs: add creators (and drafts) in popups, pull stats, move stage, share. */
export function RosterTools({
  campaignId,
  roster,
  onCampaign,
  current,
  shareUrl,
  sample,
  addDraft,
}: {
  campaignId: string;
  roster: Pick<Creator, "id" | "name" | "instagram" | "tiktok" | "instagramFollowers" | "tiktokFollowers" | "tags">[];
  onCampaign: string[];
  current: Stage;
  shareUrl?: string;
  sample: boolean;
  /** Drafts tab: the add-a-draft form, opened from its own button. */
  addDraft?: React.ReactNode;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [newCreator, setNewCreator] = useState<NewCreatorDraft>();
  const [busy, setBusy] = useState<string>();
  // Messages show next to whatever triggered them: the action buttons or the roster box.
  const [message, setMessage] = useState<{ text: string; error?: boolean; at: "actions" | "box" }>();

  const allTags = useMemo(() => [...new Set(roster.flatMap((c) => c.tags))].sort(), [roster]);

  const options = useMemo(() => {
    // A pasted profile link searches by its handle, so existing creators show up first.
    const q = (profileFromUrl(query)?.handle ?? query.trim().replace(/^@/, "")).toLowerCase();
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
    const at = key === "stats" || key === "stage" ? "actions" : "box";
    setBusy(key);
    setMessage(undefined);
    try {
      setMessage({ text: await fn(), at });
      router.refresh();
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true, at });
    } finally {
      setBusy(undefined);
    }
  }

  const nextStage: Stage | undefined = current === "creators" ? "drafts" : current === "drafts" ? "live" : undefined;

  const addCreators = (
    <div className="space-y-5">
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
                  if (profileFromUrl(q)) setNewCreator({ ...EMPTY_NEW, link: q });
                  else {
                    const handle = q.startsWith("@") ? q.slice(1) : "";
                    setNewCreator({ ...EMPTY_NEW, name: handle ? "" : q, nameAuto: false, tiktok: handle });
                  }
                  setQuery("");
                }}
                disabled={sample}
                className="w-full px-3 py-2.5 text-left font-bold hover:bg-fb-black/5"
              >
                {profileFromUrl(query)
                  ? `+ Add the creator from this ${profileFromUrl(query)!.platform === "tiktok" ? "TikTok" : "Instagram"} link`
                  : `+ Add “${query.trim()}” as a new creator`}
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
                const { link: _link, nameAuto: _auto, ...fields } = newCreator;
                const d = (await call(`/api/campaigns/${campaignId}/roster`, "POST", {
                  newCreator: { ...fields, rate: fields.rate ? Number(fields.rate) : undefined },
                })) as { added?: number; newCreator?: { created: boolean; name: string }; pullingStats?: boolean };
                setNewCreator(undefined);
                const who = d.newCreator?.name ?? newCreator.name;
                if (d.newCreator && !d.newCreator.created) {
                  return d.added
                    ? `${who} was already in the database (same handle), so we added them to this campaign as Proposed.`
                    : `${who} is already in the database and on this campaign.`;
                }
                return `Added ${who} to the Creators database and to this campaign as Proposed.${
                  d.pullingStats
                    ? " Pulling their followers and median views (last 10 posts) now; reload in a minute to see them."
                    : ""
                }`;
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

      {sample && <p className="text-sm">These tools turn on once Airtable and Apify are connected.</p>}
      {message && message.at === "box" && (
        <p role="status" className={`text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Campaign actions" className="flex flex-wrap items-center gap-3">
        {addDraft && (
          <ModalButton label="+ Add a draft" title="Add a draft" className={BUTTON}>
            <p className="mb-5 max-w-prose text-sm">
              Got a draft by email or text? Add it here for any creator, even one who isn&apos;t on this campaign yet.
            </p>
            {addDraft}
          </ModalButton>
        )}
        <ModalButton label="+ Add creators" title="Add creators" className={BUTTON}>
          {addCreators}
        </ModalButton>
        <button
          onClick={() =>
            run("stats", async () => {
              const d = await call(`/api/campaigns/${campaignId}/creator-stats`, "POST");
              return `Updated followers and median views (last 10 posts) for ${d.updated} of ${d.requested} creators.`;
            })
          }
          disabled={sample || busy === "stats"}
          className={BUTTON}
        >
          {busy === "stats" ? "Pulling stats (up to a minute)" : "Refresh creator stats"}
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
            className={BUTTON_PRIMARY}
          >
            Move campaign to {nextStage === "drafts" ? "Drafts" : "Live"}
          </button>
        )}
        {shareUrl ? (
          <CopyButton text={shareUrl} label="Copy partner share link" copiedLabel="Share link copied" variant="button" />
        ) : (
          <span className="text-sm">Tick “Partner link on” in Edit campaign to get a partner link.</span>
        )}
      </div>
      {message && message.at === "actions" && (
        <p role="status" className={`text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/** A creator's fee for this campaign, saved when the box loses focus. Shows their general rate as a hint. */
export function FeeField({
  campaignId,
  assignmentId,
  fee,
  rate,
  className = "w-28",
}: {
  campaignId: string;
  assignmentId: string;
  fee?: number;
  rate?: number;
  className?: string;
}) {
  const router = useRouter();
  const [feeInput, setFeeInput] = useState(fee ? String(fee) : "");
  const [state, setState] = useState<"saving" | "saved" | { error: string }>();

  async function save() {
    const next = feeInput ? Number(feeInput) : null;
    if (next === (fee ?? null)) return;
    setState("saving");
    try {
      await call(`/api/campaigns/${campaignId}/roster`, "PATCH", { assignmentId, fee: next });
      setState("saved");
      router.refresh();
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-bold">
        Fee ($)
        {state === "saving" && <span className="ml-2 font-normal">Saving…</span>}
        {state === "saved" && <span className="ml-2 font-normal">Saved</span>}
      </span>
      <input
        inputMode="numeric"
        value={feeInput}
        placeholder={rate ? `Rate ${rate.toLocaleString("en-US")}` : undefined}
        onChange={(e) => setFeeInput(e.target.value.replace(/[^\d]/g, ""))}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 font-bold outline-none focus:border-fb-red placeholder:font-normal placeholder:text-fb-black/50"
      />
      {typeof state === "object" && <span className="mt-1 block text-xs text-fb-red font-bold">{state.error}</span>}
    </label>
  );
}

/** Per-creator controls for the team: status, fee and the creator's private upload link. */
export function AssignmentControls({
  campaignId,
  assignmentId,
  status,
  fee,
  paid,
  uploadUrl,
}: {
  campaignId: string;
  assignmentId: string;
  status: AssignmentStatus;
  fee?: number;
  paid?: boolean;
  uploadUrl: string;
}) {
  const router = useRouter();
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
        <FeeField campaignId={campaignId} assignmentId={assignmentId} fee={fee} />
      </div>
      {status === "Approved" && <PaidToggle campaignId={campaignId} assignmentId={assignmentId} paid={paid} />}
      {status === "Approved" ? (
        <CopyButton text={uploadUrl} label="Copy draft upload link" copiedLabel="Upload link copied" />
      ) : (
        <p className="text-xs">The draft upload link appears once this creator is approved.</p>
      )}
      {error && <p className="text-fb-red font-bold">{error}</p>}
    </div>
  );
}

/** Team only: tick once the creator has been paid for this campaign. Saves straight away. */
export function PaidToggle({ campaignId, assignmentId, paid }: { campaignId: string; assignmentId: string; paid?: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(Boolean(paid));
  const [state, setState] = useState<"saving" | { error: string }>();

  async function toggle(next: boolean) {
    setOn(next);
    setState("saving");
    try {
      await call(`/api/campaigns/${campaignId}/roster`, "PATCH", { assignmentId, paid: next });
      setState(undefined);
      router.refresh();
    } catch (e) {
      setOn(!next);
      setState({ error: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <div className="text-sm">
      <label className="inline-flex cursor-pointer items-center gap-2 font-bold">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => toggle(e.target.checked)}
          disabled={state === "saving"}
          className="accent-fb-red size-4"
        />
        {on ? "Paid" : "Not paid yet"}
        {state === "saving" && <span className="font-normal text-xs">Saving…</span>}
      </label>
      {typeof state === "object" && <p className="mt-1 text-xs font-bold text-fb-red">{state.error}</p>}
    </div>
  );
}
