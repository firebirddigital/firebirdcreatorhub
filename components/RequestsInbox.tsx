"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { money, shortDate } from "@/lib/format";
import type { CampaignRequest, HubStatus } from "@/lib/requests";

const BUTTON =
  "subtitle border-2 border-fb-black px-4 py-2 text-xs hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50";
const BUTTON_PRIMARY =
  "subtitle border-2 border-fb-red bg-fb-red text-fb-white px-4 py-2 text-xs hover:bg-fb-black hover:border-fb-black transition-colors disabled:opacity-50";

type CampaignOption = { id: string; name: string; artist: string };

/**
 * Requests from the operations base's two forms (synced into this base). The team creates a campaign
 * from one, adds it to a campaign that already exists, or dismisses it.
 */
export function RequestsInbox({
  requests,
  campaigns,
  missingTables,
  sample,
}: {
  requests: CampaignRequest[];
  campaigns: CampaignOption[];
  missingTables: string[];
  sample: boolean;
}) {
  const [view, setView] = useState<HubStatus>("New");
  const counts = useMemo(() => {
    const c: Record<HubStatus, number> = { New: 0, Accepted: 0, Dismissed: 0 };
    requests.forEach((r) => c[r.hubStatus]++);
    return c;
  }, [requests]);
  const shown = requests.filter((r) => r.hubStatus === view);

  if (!requests.length && missingTables.length === 2) {
    return (
      <p className="mt-6 max-w-prose text-sm">
        Campaign requests will show here once the hub can read the request forms (couldn&apos;t find{" "}
        {missingTables.join(" or ")}).
      </p>
    );
  }

  return (
    <section aria-label="Campaign requests" className="mt-10 border-2 border-fb-black p-6 max-sm:p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="headline text-3xl">
          {counts.New ? `${counts.New} new ${counts.New === 1 ? "request" : "requests"}` : "Requests"}
        </h2>
        <div role="group" aria-label="Show requests" className="flex gap-2 text-sm">
          {(["New", "Accepted", "Dismissed"] as HubStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setView(s)}
              aria-pressed={view === s}
              className={`px-3 py-1 font-bold border-2 ${view === s ? "bg-fb-black border-fb-black text-fb-white" : "border-fb-black hover:bg-fb-black/10"}`}
            >
              {s} {counts[s]}
            </button>
          ))}
        </div>
      </div>
      {missingTables.length > 0 && (
        <p className="mt-2 text-xs">Couldn&apos;t read: {missingTables.join(" and ")}.</p>
      )}

      {shown.length === 0 ? (
        <p className="mt-6 text-sm">{view === "New" ? "No new requests. New form submissions show up here within a few minutes." : `Nothing ${view.toLowerCase()}.`}</p>
      ) : (
        <ul className="mt-6 space-y-6">
          {shown.map((r) => (
            <li key={r.id}>
              <RequestCard request={r} campaigns={campaigns} sample={sample} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RequestCard({ request: r, campaigns, sample }: { request: CampaignRequest; campaigns: CampaignOption[]; sample: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  // Suggest the likely existing campaign: same artist, newest first.
  const sameArtist = campaigns.filter((c) => r.artist && c.artist.toLowerCase().includes(r.artist.toLowerCase()));
  const [linkTo, setLinkTo] = useState(sameArtist[0]?.id ?? "");

  async function act(action: "create" | "link" | "dismiss" | "reopen") {
    setBusy(action);
    setError(undefined);
    setNote(undefined);
    const res = await fetch(`/api/requests/${r.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, campaignId: action === "link" ? linkTo : undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; campaignId?: string; contactsSaved?: boolean; filled?: string[] };
    setBusy(undefined);
    if (!res.ok) {
      setError(data.error ?? "That didn't work. Try again.");
      return;
    }
    if (data.contactsSaved === false) {
      setNote("Saved, but partner contacts weren't: add a “Partner Contacts” long text field to Campaigns in Airtable.");
    }
    if (action === "link" && data.campaignId) {
      // Straight to the campaign, where the details just filled in can be checked.
      router.push(`/campaigns/${data.campaignId}`);
      return;
    }
    if (action === "create" && data.campaignId) {
      router.push(`/campaigns/${data.campaignId}?tab=creators`);
      return;
    }
    router.refresh();
  }

  const facts = [
    r.partners.length ? `Partner: ${r.partners.join(", ")}` : "",
    r.launchDate ? `Launch ${shortDate(r.launchDate)}${r.endDate ? ` – ${shortDate(r.endDate)}` : ""}` : "",
    r.keyDate ? `Key date ${shortDate(r.keyDate)}` : "",
    r.budget ? money(r.budget) : "",
    r.platforms.join(", "),
    r.strategy.join(", "),
  ].filter(Boolean);

  return (
    <article className="border-t-2 border-fb-black pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-sm">
            {r.artist} · {r.source === "influencer" ? "Influencer" : "Content Seeding"} request
            {r.status ? ` · ${r.status} in the ops base` : ""}
          </p>
          <h3 className="subtitle mt-1 text-xl">{r.name}</h3>
        </div>
        <span className="text-xs">Submitted {shortDate(r.createdTime)}</span>
      </div>
      <p className="mt-2 text-sm">{facts.join(" · ")}</p>
      <p className="mt-1 text-xs">
        {[r.submitterEmail && `From ${r.submitterEmail}`, (r.billingName || r.billingEmail) && `Billing: ${[r.billingName, r.billingEmail].filter(Boolean).join(", ")}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {r.sections.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-bold underline underline-offset-4">Read the request</summary>
          <dl className="mt-3 space-y-3">
            {r.sections.map((s) => (
              <div key={s.label}>
                <dt className="text-xs font-bold">{s.label}</dt>
                <dd className="mt-1 whitespace-pre-line">{s.text}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        {r.hubStatus === "New" && (
          <>
            <button onClick={() => act("create")} disabled={sample || Boolean(busy)} className={BUTTON_PRIMARY}>
              {busy === "create" ? "Creating" : "Create campaign"}
            </button>
            <label className="flex items-end gap-2">
              <span className="sr-only">Add to an existing campaign</span>
              <select
                value={linkTo}
                onChange={(e) => setLinkTo(e.target.value)}
                disabled={sample || Boolean(busy)}
                className="max-w-64 border-b-2 border-fb-black bg-transparent py-1.5 text-sm font-bold outline-none focus:border-fb-red"
              >
                <option value="">Add to existing…</option>
                {[...sameArtist, ...campaigns.filter((c) => !sameArtist.includes(c))].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button onClick={() => act("link")} disabled={sample || !linkTo || Boolean(busy)} className={BUTTON}>
                {busy === "link" ? "Adding" : "Add"}
              </button>
            </label>
            <button
              onClick={() => act("dismiss")}
              disabled={sample || Boolean(busy)}
              className="text-xs underline underline-offset-4 hover:text-fb-red disabled:opacity-50"
            >
              Dismiss
            </button>
          </>
        )}
        {r.hubStatus === "Accepted" &&
          r.hubCampaignIds.map((id) => (
            <a key={id} href={`/campaigns/${id}`} className={BUTTON}>
              Open {campaigns.find((c) => c.id === id)?.name ?? "campaign"}
            </a>
          ))}
        {r.hubStatus === "Dismissed" && (
          <button onClick={() => act("reopen")} disabled={sample || Boolean(busy)} className={BUTTON}>
            Put back in New
          </button>
        )}
      </div>
      {sample && <p className="mt-2 text-xs">Sample request. Actions turn on once Airtable is connected.</p>}
      {note && <p className="mt-2 text-sm font-bold">{note}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
    </article>
  );
}
