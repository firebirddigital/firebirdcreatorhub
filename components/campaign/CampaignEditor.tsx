"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CAMPAIGN_TYPES, campaignType, type Campaign, type CampaignStatus, type CampaignType, type Stage } from "@/lib/types";

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
}

const fromCampaign = (c?: Campaign, stage?: Stage, type?: CampaignType): FormState => ({
  type: c ? campaignType(c) : (type ?? "Influencer"),
  name: c?.name ?? "",
  artist: c?.artist ?? "",
  song: c?.song ?? "",
  startDate: c?.startDate ?? "",
  endDate: c?.endDate ?? "",
  budget: c?.budget ? String(c.budget) : "",
  status: c?.status ?? "Planning",
  stage: stage ?? "creators",
  brief: c?.brief ?? "",
  sharingEnabled: c?.sharingEnabled ?? false,
  showRates: c?.showRates ?? false,
});

const toPayload = (f: FormState) => ({
  ...f,
  startDate: f.startDate || null,
  endDate: f.endDate || null,
  budget: f.budget ? Number(f.budget) : null,
});

function Fields({ f, set }: { f: FormState; set: (patch: Partial<FormState>) => void }) {
  const input =
    "mt-1 block w-full border-b-2 border-fb-black bg-transparent py-2 outline-none focus:border-fb-red";
  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      <fieldset className="md:col-span-2">
        <legend className="text-sm font-bold">Type</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAMPAIGN_TYPES.map((t) => (
            <label
              key={t}
              className={`cursor-pointer px-4 py-2 text-sm font-bold border-2 transition-colors ${
                f.type === t ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-black hover:bg-fb-black hover:text-fb-white"
              }`}
            >
              <input
                type="radio"
                name="campaign-type"
                value={t}
                checked={f.type === t}
                onChange={() => set({ type: t })}
                className="sr-only"
              />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="md:col-span-2">
        <span className="text-sm font-bold">Campaign name</span>
        <input required value={f.name} onChange={(e) => set({ name: e.target.value })} className={`${input} text-lg`} />
      </label>
      <label>
        <span className="text-sm font-bold">Artist</span>
        <input value={f.artist} onChange={(e) => set({ artist: e.target.value })} className={input} />
      </label>
      <label>
        <span className="text-sm font-bold">Song</span>
        <input value={f.song} onChange={(e) => set({ song: e.target.value })} className={input} />
      </label>
      <label>
        <span className="text-sm font-bold">Start date</span>
        <input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} className={input} />
      </label>
      <label>
        <span className="text-sm font-bold">End date</span>
        <input type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} className={input} />
      </label>
      <label>
        <span className="text-sm font-bold">Budget ($)</span>
        <input
          inputMode="numeric"
          value={f.budget}
          onChange={(e) => set({ budget: e.target.value.replace(/[^\d]/g, "") })}
          className={input}
        />
      </label>
      <div className="grid grid-cols-2 gap-6">
        <label>
          <span className="text-sm font-bold">Status</span>
          <select
            value={f.status}
            onChange={(e) => set({ status: e.target.value as CampaignStatus })}
            className={`${input} font-bold`}
          >
            <option>Planning</option>
            <option>Live</option>
            <option>Wrapped</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-bold">Stage</span>
          <select value={f.stage} onChange={(e) => set({ stage: e.target.value as Stage })} className={`${input} font-bold`}>
            <option value="creators">Creators</option>
            <option value="drafts">Drafts</option>
            <option value="live">Live</option>
          </select>
        </label>
      </div>
      <label className="md:col-span-2">
        <span className="text-sm font-bold">Brief</span>
        <span className="block text-xs">Creators see this on their upload page.</span>
        <textarea
          rows={4}
          value={f.brief}
          onChange={(e) => set({ brief: e.target.value })}
          className="mt-2 w-full border-2 border-fb-black p-2 outline-none focus:border-fb-red"
        />
      </label>
      <div className="md:col-span-2 flex flex-wrap gap-x-8 gap-y-3">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={f.sharingEnabled}
            onChange={(e) => set({ sharingEnabled: e.target.checked })}
            className="size-4 accent-fb-red"
          />
          <span className="text-sm">
            <span className="font-bold">Partner link on.</span> Untick to switch the share link off.
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
      </div>
    </div>
  );
}

/** Team-only panel for editing a campaign's details in place. */
export function CampaignEditor({ campaign, stage, sample }: { campaign: Campaign; stage: Stage; sample: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<FormState>(() => fromCampaign(campaign, stage));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState<boolean | "type-missing">(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(f)),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; typeSaved?: boolean };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Changes didn't save. Try again.");
      return;
    }
    setOpen(false);
    setSaved(data.typeSaved === false ? "type-missing" : true);
    setTimeout(() => setSaved(false), data.typeSaved === false ? 8000 : 3000);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="flex items-center gap-4">
        <button
          onClick={() => {
            setF(fromCampaign(campaign, stage));
            setOpen(true);
          }}
          className="subtitle border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors"
        >
          Edit campaign
        </button>
        {saved && (
          <span role="status" className="text-sm">
            {saved === "type-missing"
              ? "Campaign saved, except Type: add a single select field called Type to the Campaigns table in Airtable."
              : "Campaign saved."}
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="border-2 border-fb-black p-6 max-sm:p-4 space-y-6">
      <h2 className="headline text-3xl">Edit campaign</h2>
      <Fields f={f} set={(p) => setF((cur) => ({ ...cur, ...p }))} />
      {sample && <p className="text-sm">Editing turns on once Airtable is connected.</p>}
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          disabled={busy || sample}
          className="subtitle bg-fb-red text-fb-white px-8 py-3.5 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
        >
          {busy ? "Saving" : "Save campaign"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline underline-offset-4">
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Bottom of the Campaigns list: set up a campaign by hand when there's no request form, for example a
 * dashboard just to track some posts. Starts Live, on the Live tab, so posts can go straight in.
 */
export function ManualCampaign({ sample, type }: { sample: boolean; type?: CampaignType }) {
  const router = useRouter();
  const blank = () => ({ ...fromCampaign(undefined, "live", type), status: "Live" as CampaignStatus });
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          onClick={() => {
            setF(blank());
            setOpen(true);
          }}
          disabled={sample}
          title={sample ? "Connect Airtable to create campaigns" : undefined}
          className="subtitle border-2 border-fb-black px-5 py-2.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50"
        >
          Manual upload
        </button>
        <span className="text-sm">No request form? Set up a dashboard by hand, for example just to track some posts.</span>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="border-2 border-fb-black p-6 max-sm:p-4 space-y-6">
      <div>
        <h2 className="headline text-3xl">Manual upload</h2>
        <p className="mt-1 text-sm">It starts Live so you can add posts straight away. Change the stage below if you need to.</p>
      </div>
      <Fields f={f} set={(p) => setF((cur) => ({ ...cur, ...p }))} />
      {error && (
        <p role="alert" className="text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          disabled={busy}
          className="subtitle bg-fb-red text-fb-white px-8 py-3.5 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
        >
          {busy ? "Creating" : "Create campaign"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline underline-offset-4">
          Cancel
        </button>
      </div>
    </form>
  );
}
