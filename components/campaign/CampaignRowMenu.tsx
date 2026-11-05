"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CAMPAIGN_STATUSES, type CampaignStatus } from "@/lib/types";

type View = "main" | "folders" | "status" | "delete";

/**
 * The ⋯ button at the end of a campaign row: add to a folder, set the status, or delete the campaign.
 * Team only.
 */
export function CampaignRowMenu({
  campaign,
  folders,
}: {
  campaign: { id: string; name: string; status: CampaignStatus };
  folders: { id: string; name: string; campaignIds: string[] }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [newFolder, setNewFolder] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setView("main");
    setError(undefined);
    setNewFolder("");
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(undefined);
    const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
    setBusy(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That didn't work. Try again.");
      return false;
    }
    close();
    router.refresh();
    return true;
  }

  const toggleFolder = (f: { id: string; campaignIds: string[] }) =>
    call(`/api/folders/${f.id}`, {
      method: "PATCH",
      body: JSON.stringify(f.campaignIds.includes(campaign.id) ? { remove: [campaign.id] } : { add: [campaign.id] }),
    });

  return (
    <div ref={box} className="export-wrap">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${campaign.name}`}
        className="row-menu-button"
      >
        <svg aria-hidden viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <circle cx="4" cy="10" r="1.7" />
          <circle cx="10" cy="10" r="1.7" />
          <circle cx="16" cy="10" r="1.7" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="export-menu row-menu">
          {view === "main" && (
            <>
              <button role="menuitem" type="button" onClick={() => setView("folders")}>
                Add to folder <span aria-hidden>›</span>
              </button>
              <button role="menuitem" type="button" onClick={() => setView("status")}>
                Set status <span aria-hidden>›</span>
              </button>
              <button role="menuitem" type="button" onClick={() => setView("delete")} className="menu-danger">
                Delete campaign
              </button>
            </>
          )}

          {view === "folders" && (
            <>
              <p className="menu-label">Add to folder</p>
              {folders.length === 0 && <p className="menu-note">No folders yet. Make one below.</p>}
              {folders.map((f) => {
                const inIt = f.campaignIds.includes(campaign.id);
                return (
                  <button
                    key={f.id}
                    role="menuitemcheckbox"
                    aria-checked={inIt}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleFolder(f)}
                    title={inIt ? "Already in this folder. Click to take it out." : undefined}
                  >
                    <span className="truncate">{f.name}</span>
                    {inIt && <span aria-hidden className="text-fb-red">✓</span>}
                  </button>
                );
              })}
              <form
                className="menu-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newFolder.trim())
                    call("/api/folders", { method: "POST", body: JSON.stringify({ name: newFolder, campaignIds: [campaign.id] }) });
                }}
              >
                <input
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  placeholder="New folder name"
                  aria-label="New folder name"
                  className="field"
                  maxLength={80}
                />
                <button type="submit" disabled={busy || !newFolder.trim()} className="btn btn-sm btn-primary">
                  Create
                </button>
              </form>
            </>
          )}

          {view === "status" && (
            <>
              <p className="menu-label">Status</p>
              {CAMPAIGN_STATUSES.map((s) => (
                <button
                  key={s}
                  role="menuitemradio"
                  aria-checked={s === campaign.status}
                  type="button"
                  disabled={busy || s === campaign.status}
                  onClick={() => call(`/api/campaigns/${campaign.id}`, { method: "PATCH", body: JSON.stringify({ status: s }) })}
                >
                  {s}
                  {s === campaign.status && <span aria-hidden className="text-fb-red">✓</span>}
                </button>
              ))}
            </>
          )}

          {view === "delete" && (
            <div className="menu-confirm">
              <p className="font-bold">Delete “{campaign.name}”?</p>
              <p className="mt-1 text-xs text-secondary">
                This removes the campaign and its creators, drafts, live posts and stats history from Airtable. You
                can only get it back from Airtable&apos;s trash, for a limited time.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => call(`/api/campaigns/${campaign.id}`, { method: "DELETE" })}
                  className="btn btn-sm btn-primary"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
                <button type="button" onClick={() => setView("main")} className="btn btn-sm btn-quiet">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {view !== "main" && view !== "delete" && (
            <button type="button" onClick={() => setView("main")} className="menu-back">
              ‹ Back
            </button>
          )}
          {error && <p className="menu-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
