"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CAMPAIGN_STATUSES, CAMPAIGN_TYPES, campaignType, type Campaign, type CampaignStatus, type CampaignType, type Stage } from "@/lib/types";

interface FormState {
  type: CampaignType;
  name: string;
  artist: string;
  song: string;
  startDate: string;
  endDate: string;
  budget: string;
  status: CampaignStatus;
  stage: Stage;
  brief: string;
  sharingEnabled: boolean;
  showRates: boolean;
  /** Edit only: partners see creators' engagement rates. Saved as a hub setting, not in Airtable. */
  showEngagementToPartners?: boolean;
}

const fromCampaign = (c?: Campaign, stage?: Stage, type?: CampaignType): FormState => ({
  type: c ? campaignType(c) : (type ?? "Influencer"),
  name: c?.name ?? "",
  artist: c?.artist ?? "",
  song: c?.song ?? "",
  startDate: c?.startDate ?? "",
  endDate: c?.endDate ?? "",
  budget: c?.budget ? String(c.budget) : "",
  status: c?.status ?? "Awaiting approval",
  stage: stage ?? "creators",
  brief: c?.brief ?? "",
  sharingEnabled: c?.sharingEnabled ?? false,
  showRates: c?.showRates ?? false,
});

const toPayload = ({ showEngagementToPartners: _eng, ...f }: FormState) => ({
  ...f,
  startDate: f.startDate || null,
  endDate: f.endDate || null,
  budget: f.budget ? Number(f.budget) : null,
});

function Fields({ f, set }: { f: FormState; set: (patch: Partial<FormState>) => void }) {
  const input = "field";
  // Content Seeding is Live only and always shared, so its stage and partner link aren't choices.
  const seeding = f.type === "Content Seeding";
  return (
    <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
      <fieldset className="md:col-span-2">
        <legend className="field-label">Type</legend>
        <div className="seg flex-wrap">
          {CAMPAIGN_TYPES.map((t) => (
            <label
              key={t}
              className={`cursor-pointer rounded-full px-[13px] py-1.5 text-[13px] transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fb-red ${
                f.type === t ? "bg-fb-red font-bold text-white shadow-tile" : "text-secondary hover:bg-surface hover:text-fb-black"
              }`}
            >
              <input
                type="radio"
                name="campaign-type"
                value={t}
                checked={f.type === t}
                onChange={() => set(t === "Content Seeding" ? { type: t, stage: "live", sharingEnabled: true } : { type: t })}
                className="sr-only"
              />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="md:col-span-2">
        <span className="field-label">Campaign name</span>
        <input required value={f.name} onChange={(e) => set({ name: e.target.value })} className={input} />
      </label>
      <label>
        <span className="field-label">Artist</span>
        <input value={f.artist} onChange={(e) => set({ artist: e.target.value })} className={input} />
      </label>
      <label>
        <span className="field-label">Song</span>
        <input value={f.song} onChange={(e) => set({ song: e.target.value })} className={input} />
      </label>
      <label>
        <span className="field-label">Start date</span>
        <input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} />
      </label>
      <label>
        <span className="field-label">End date</span>
        <input type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className={input} />
      </label>
      <label>
        <span className="field-label">Budget ($)</span>
        <input
          inputMode="numeric"
          value={f.budget}
          onChange={(e) => set({ budget: e.target.value.replace(/[^\d]/g, "") })}
          className={input}
        />
      </label>
      <div className={seeding ? "" : "grid grid-cols-2 gap-3.5"}>
        <label>
          <span className="field-label">Status</span>
          <select
            value={f.status}
            onChange={(e) => set({ status: e.target.value as CampaignStatus })}
            className={input}
          >
            {CAMPAIGN_STATUSES.map((st) => (
              <option key={st}>{st}</option>
            ))}
          </select>
        </label>
        {!seeding && <label>
          <span className="field-label">Stage</span>
          <select value={f.stage} onChange={(e) => set({ stage: e.target.value as Stage })} className={input}>
            <option value="creators">Creators</option>
            <option value="drafts">Drafts</option>
            <option value="live">Live</option>
          </select>
        </label>}
      </div>
      <label className="md:col-span-2">
        <span className="field-label">Brief</span>
        <span className="-mt-0.5 mb-1.5 block text-xs text-muted">Creators see this on their upload page.</span>
        <textarea
          rows={4}
          value={f.brief}
          onChange={(e) => set({ brief: e.target.value })}
          className="field"
        />
      </label>
      <div className="md:col-span-2 flex flex-wrap gap-x-6 gap-y-2.5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={seeding || f.sharingEnabled}
            disabled={seeding}
            onChange={(e) => set({ sharingEnabled: e.target.checked })}
            className="size-4 accent-fb-red"
          />
          <span className="text-sm">
            <span className="font-bold">Partner link on.</span>{" "}
            {seeding ? "Always on for Content Seeding." : "Untick to switch the share link off."}
          </span>
        </label>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={f.showRates}
            onChange={(e) => set({ showRates: e.target.checked })}
            className="size-4 accent-fb-red"
          />
          <span className="text-sm">
            <span className="font-bold">Show fees to partner.</span> Off by default.
          </span>
        </label>
        {f.showEngagementToPartners !== undefined && (
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={f.showEngagementToPartners}
              onChange={(e) => set({ showEngagementToPartners: e.target.checked })}
              className="size-4 accent-fb-red"
            />
            <span className="text-sm">
              <span className="font-bold">Show engagement rates to partner.</span> Each creator&apos;s rate over their last 10 posts.
            </span>
          </label>
        )}
      </div>
    </div>
  );
}

/** Team only: "Edit campaign" at the top right of a campaign, opening the details in a popup. */
export function CampaignEditor({
  campaign,
  stage,
  sample,
  engagementToPartners,
}: {
  campaign: Campaign;
  stage: Stage;
  sample: boolean;
  engagementToPartners: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const initial = () => ({ ...fromCampaign(campaign, stage), showEngagementToPartners: engagementToPartners });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(f)),
    }).catch(() => undefined);
    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (res?.ok && f.showEngagementToPartners !== engagementToPartners) {
      const s = await fetch(`/api/campaigns/${campaign.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showEngagementToPartners: f.showEngagementToPartners }),
      }).catch(() => undefined);
      if (!s?.ok) {
        setBusy(false);
        setError("Campaign saved, but the engagement rate setting didn't. Try again.");
        router.refresh();
        return;
      }
    }
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? "Changes didn't save. Try again.");
      return;
    }
    setOpen(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => {
            setF(initial());
            setError(undefined);
            setOpen(true);
          }}
          className="btn"
        >
          Edit campaign
        </button>
        {saved && (
          <span role="status" className="text-xs text-secondary">
            Campaign saved.
          </span>
        )}
      </div>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        aria-label="Edit campaign"
        className="sheet m-auto w-[min(44rem,calc(100vw-2rem))] max-h-[calc(100vh-4rem)] overflow-y-auto"
      >
        {open && (
          <form onSubmit={save}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-surface px-5 py-3.5">
              <h2 className="font-display text-xs font-bold uppercase tracking-[0.08em]">Edit campaign</h2>
              <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet btn-sm">
                Close
              </button>
            </div>
            <div className="space-y-4 p-5 max-sm:p-4">
              <Fields f={f} set={(p) => setF((cur) => ({ ...cur, ...p }))} />
              {sample && <p className="text-xs text-muted">Editing turns on once Airtable is connected.</p>}
              {error && (
                <p role="alert" className="text-sm font-bold text-fb-red">
                  {error}
                </p>
              )}
              <div className="flex items-center gap-2.5 border-t border-line pt-4">
                <button disabled={busy || sample} className="btn btn-primary">
                  {busy ? "Saving" : "Save campaign"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
                  Cancel
                </button>
              </div>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

/**
 * Bottom of the Campaigns list: set up a campaign by hand when there's no request form, for example a
 * dashboard just to track some posts. Starts Live, on the Live tab, so posts can go straight in.
 */
export function ManualCampaign({ sample, type }: { sample: boolean; type?: CampaignType }) {
  const router = useRouter();
  // Partner link starts on: untick it in the form to keep a new campaign private.
  const blank = () => ({ ...fromCampaign(undefined, "live", type), status: "Live" as CampaignStatus, sharingEnabled: true });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FormState>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(f)),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    if (!res.ok || !data.id) {
      setBusy(false);
      setError(data.error ?? "Couldn't create the campaign. Try again.");
      return;
    }
    router.push(`/campaigns/${data.id}?tab=${f.stage}`);
  }

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          onClick={() => {
            setF(blank());
            setOpen(true);
          }}
          disabled={sample}
          title={sample ? "Connect Airtable to create campaigns" : undefined}
          className="btn"
        >
          Manual upload
        </button>
        <span className="text-xs text-muted">No request form? Set up a dashboard by hand, for example just to track some posts.</span>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="card space-y-4">
      <div>
        <h2>Manual upload</h2>
        <p className="caption mb-0">It starts Live so you can add posts straight away. Change the stage below if you need to.</p>
      </div>
      <Fields f={f} set={(p) => setF((cur) => ({ ...cur, ...p }))} />
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2.5 border-t border-line pt-4">
        <button
          disabled={busy}
          className="btn btn-primary"
        >
          {busy ? "Creating" : "Create campaign"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn btn-quiet">
          Cancel
        </button>
      </div>
    </form>
  );
}
