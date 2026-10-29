"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

/**
 * Team panel on a campaign: email the partner dashboard link to the request's contacts or anyone added here.
 * New addresses are saved to the campaign's Partner Contacts.
 */
export function EmailDashboard({
  campaignId,
  contacts,
  sharingEnabled,
  emailReady,
  gmail,
}: {
  campaignId: string;
  /** Emails from Partner Contacts (the request submitter and anyone added before). */
  contacts: string[];
  sharingEnabled: boolean;
  emailReady: boolean;
  /** Gmail sending: whether Google is set up, which address is connected, and the result of a connect attempt. */
  gmail: { configured: boolean; sender?: string; status?: string };
}) {
  const router = useRouter();
  const [people, setPeople] = useState(() => contacts.map((email) => ({ email, on: true, added: false })));
  const [adding, setAdding] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ text: string; error?: boolean }>();
  const chosen = people.filter((p) => p.on).map((p) => p.email);

  function add() {
    const found = adding.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    const bad = found.filter((e) => !isEmail(e));
    if (bad.length) return setResult({ text: `Check ${bad.join(", ")}.`, error: true });
    setPeople((cur) => {
      const have = new Set(cur.map((p) => p.email.toLowerCase()));
      return [...cur, ...found.filter((e) => !have.has(e.toLowerCase())).map((email) => ({ email, on: true, added: true }))];
    });
    setAdding("");
    setResult(undefined);
  }

  async function send() {
    setBusy(true);
    setResult(undefined);
    const res = await fetch(`/api/campaigns/${campaignId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: chosen, note, save: people.filter((p) => p.added).map((p) => p.email) }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; failed?: string[]; saveError?: string };
    setBusy(false);
    if (!res.ok) return setResult({ text: data.error ?? "That didn't send. Try again.", error: true });
    setResult({
      text: [
        `Sent to ${data.sent} ${data.sent === 1 ? "person" : "people"}.`,
        data.failed?.length ? `Didn't reach ${data.failed.map((f) => f.split(":")[0]).join(", ")}.` : "",
        data.saveError ?? "",
      ]
        .filter(Boolean)
        .join(" "),
      error: Boolean(data.failed?.length || data.saveError),
    });
    setNote("");
    setPeople((cur) => cur.map((p) => ({ ...p, added: false })));
    router.refresh();
  }

  const blocked = !sharingEnabled
    ? "Turn on the partner link in Edit campaign to email the dashboard."
    : !emailReady
      ? gmail.configured
        ? "Connect Gmail to send."
        : "Email isn't set up yet: Google sign-in for the hub still needs adding."
      : undefined;
  const statusText: Record<string, string> = {
    connected: "Gmail connected.",
    cancelled: "Gmail wasn't connected.",
    expired: "That sign-in took too long. Connect Gmail again.",
    failed: "Gmail didn't connect. Try again, and tick the box that lets the hub send email.",
  };

  async function disconnect() {
    if (!confirm("Stop sending from this Gmail? You can connect again any time.")) return;
    await fetch("/api/gmail/disconnect", { method: "POST" });
    router.refresh();
  }

  return (
    <details open={Boolean(gmail.status)} className="-mt-6 border-2 border-fb-black p-5 max-sm:p-4">
      <summary className="cursor-pointer subtitle text-sm">Email the dashboard</summary>
      <div className="mt-4 space-y-4 text-sm">
        <p className="max-w-prose">
          Sends each person their own email with the latest numbers and a button to the partner dashboard. No fees or
          budget are included.
        </p>
        {gmail.status && statusText[gmail.status] && (
          <p className={`font-bold ${gmail.status === "connected" ? "" : "text-fb-red"}`}>{statusText[gmail.status]}</p>
        )}
        {gmail.configured && (
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            {gmail.sender ? (
              <>
                <span>
                  Sending from <span className="font-bold">{gmail.sender}</span> (Gmail)
                </span>
                <button type="button" onClick={disconnect} className="underline underline-offset-4 hover:text-fb-red">
                  Disconnect
                </button>
              </>
            ) : (
              <a
                href={`/api/gmail/connect?back=${encodeURIComponent(`/campaigns/${campaignId}`)}`}
                className="subtitle border-2 border-fb-black px-4 py-2 text-xs hover:bg-fb-black hover:text-fb-white transition-colors"
              >
                Connect Gmail
              </a>
            )}
          </p>
        )}

        <fieldset>
          <legend className="text-xs font-bold">Send to</legend>
          {people.length ? (
            <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
              {people.map((p) => (
                <li key={p.email}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.on}
                      onChange={(e) => setPeople((cur) => cur.map((x) => (x.email === p.email ? { ...x, on: e.target.checked } : x)))}
                      className="size-4 accent-fb-red"
                    />
                    {p.email}
                    {p.added && <span className="text-xs">(new, saved on send)</span>}
                  </label>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2">No contacts on this campaign yet. Add an email below.</p>
          )}
        </fieldset>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block grow max-w-sm">
            <span className="text-xs font-bold">Add people</span>
            <input
              type="email"
              multiple
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              placeholder="name@label.com"
              className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 outline-none focus:border-fb-red"
            />
          </label>
          <button type="button" onClick={add} disabled={!adding.trim()} className="pb-2 font-bold underline underline-offset-4 disabled:opacity-50">
            Add
          </button>
        </div>

        <label className="block max-w-xl">
          <span className="text-xs font-bold">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. Great first week. The top two posts are already past 1M."
            className="mt-1 block w-full border-2 border-fb-black bg-transparent p-2 outline-none focus:border-fb-red"
          />
        </label>

        {blocked && <p className="font-bold">{blocked}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={send}
            disabled={busy || !chosen.length || Boolean(blocked)}
            className="subtitle border-2 border-fb-red bg-fb-red text-fb-white px-5 py-2.5 text-sm hover:bg-fb-black hover:border-fb-black transition-colors disabled:opacity-50"
          >
            {busy ? "Sending…" : `Send to ${chosen.length} ${chosen.length === 1 ? "person" : "people"}`}
          </button>
          <a
            href={`/api/campaigns/${campaignId}/email${note.trim() ? `?note=${encodeURIComponent(note.trim())}` : ""}`}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-fb-red"
          >
            Preview email
          </a>
          {result && <p className={result.error ? "font-bold text-fb-red" : "font-bold"}>{result.text}</p>}
        </div>
      </div>
    </details>
  );
}
