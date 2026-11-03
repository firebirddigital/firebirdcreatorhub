"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { money, shortDate } from "@/lib/format";
import type { CampaignRequest, HubStatus } from "@/lib/requests";

const BUTTON = "btn btn-sm";
const BUTTON_PRIMARY = "btn btn-primary btn-sm";

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
      <p className="banner mt-3.5 max-w-prose">
        Campaign requests will show here once the hub can read the request forms (couldn&apos;t find{" "}
        {missingTables.join(" or ")}).
      </p>
    );
  }

  return (
    <section aria-label="Campaign requests" className="card mt-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="mb-0">
          {counts.New ? `${counts.New} new ${counts.New === 1 ? "request" : "requests"}` : "Requests"}
        </h2>
        <div role="group" aria-label="Show requests" className="seg">
          {(["New", "Accepted", "Dismissed"] as HubStatus[]).map((s) => (
            <button
              key={s}
              onClick={() => setView(s)}
              aria-pressed={view === s}
            >
              {s} {counts[s]}
            </button>
          ))}
        </div>
      </div>
      {missingTables.length > 0 && (
        <p className="mt-2 text-xs text-muted">Couldn&apos;t read: {missingTables.join(" and ")}.</p>
      )}

      {shown.length === 0 ? (
        <p className="empty">{view === "New" ? "No new requests. New form submissions show up here within a few minutes." : `Nothing ${view.toLowerCase()}.`}</p>
      ) : (
        <ul className="mt-4">
          {shown.map((r) => (
            <li key={r.id} className="border-t border-line py-4 last:pb-0">
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
    <article>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <div>
          <p className="text-xs text-muted">
            {r.artist} · {r.source === "influencer" ? "Influencer" : "Content Seeding"} request
            {r.status ? ` · ${r.status} in the ops base` : ""}
          </p>
          <h3 className="mt-0.5 font-display text-[15px] font-bold tracking-[0.02em]">{r.name}</h3>
        </div>
        <span className="text-xs text-muted">Submitted {shortDate(r.createdTime)}</span>
      </div>
      <p className="mt-2 text-sm text-secondary">{facts.join(" · ")}</p>
      <p className="mt-1 text-xs text-muted">
        {[r.submitterEmail && `From ${r.submitterEmail}`, (r.billingName || r.billingEmail) && `Billing: ${[r.billingName, r.billingEmail].filter(Boolean).join(", ")}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {r.sections.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-bold underline underline-offset-4 hover:text-fb-red">Read the request</summary>
          <dl className="mt-3 space-y-3 rounded-control bg-wash-neutral p-3.5">
            {r.sections.map((s) => (
              <div key={s.label}>
                <dt className="field-label mb-0">{s.label}</dt>
                <dd className="mt-1 whitespace-pre-line">{s.text}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
        {r.hubStatus === "New" && (
          <>
            <button onClick={() => act("create")} disabled={sample || Boolean(busy)} className={BUTTON_PRIMARY}>
              {busy === "create" ? "Creating" : "Create campaign"}
            </button>
            <label className="flex items-center gap-2">
              <span className="sr-only">Add to an existing campaign</span>
              <select
                value={linkTo}
                onChange={(e) => setLinkTo(e.target.value)}
                disabled={sample || Boolean(busy)}
                className="field w-auto max-w-64 min-h-[30px] py-1 text-[13px]"
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
              className="btn btn-quiet btn-sm"
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
      {sample && <p className="mt-2 text-xs text-muted">Sample request. Actions turn on once Airtable is connected.</p>}
      {note && <p className="mt-2 text-sm font-bold">{note}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-fb-red">
          {error}
        </p>
      )}
    </article>
  );
}
