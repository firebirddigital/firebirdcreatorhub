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
  const [busy, setBusy] = useState<string>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

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
              <li className="px-3 py-2.5 text-sm">No one on the roster matches. Add new creators in Airtable first.</li>
            )}
          </ul>
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
