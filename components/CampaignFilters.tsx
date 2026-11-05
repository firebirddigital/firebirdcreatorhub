"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CAMPAIGN_STATUSES } from "@/lib/types";

/**
 * Search, partner, status and artist filters and the sort for the campaigns list. They all live in the
 * address, so a filtered view can be shared.
 */
export function CampaignFilters({
  partners,
  artists,
  manualArtists,
}: {
  partners: { name: string; portfolio: boolean }[];
  artists: string[];
  /** Artists the team added by hand (they can be removed again). */
  manualArtists: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const partner = params.get("partner") ?? "";
  const status = params.get("status") ?? "";
  const artist = params.get("artist") ?? "";
  const sort = params.get("sort") === "created" ? "created" : "edited";
  const [adding, setAdding] = useState(false);
  const [newArtist, setNewArtist] = useState("");
  const [error, setError] = useState<string>();

  const go = (change: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(change)) v ? next.set(k, v) : next.delete(k);
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => go({ q: q.trim() }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function saveArtist(name: string, present: boolean) {
    setError(undefined);
    const res = await fetch("/api/artists", {
      method: present ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; name?: string };
    if (!res.ok) {
      setError(data.error ?? "That didn't save. Try again.");
      return;
    }
    setAdding(false);
    setNewArtist("");
    go({ artist: present ? (data.name ?? name) : "" });
    router.refresh();
  }

  const portfolio = partners.filter((p) => p.portfolio);
  const others = partners.filter((p) => !p.portfolio);
  const isManual = artist && manualArtists.some((a) => a.toLowerCase() === artist.toLowerCase());
  return (
    <div className="filter-row">
      <label className="grow max-w-md">
        Search
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Campaign, artist or song"
          className="w-full"
        />
      </label>
      <label>
        Partner
        <select className="min-w-[200px] max-sm:min-w-0" value={partner} onChange={(e) => go({ partner: e.target.value })}>
          <option value="">All partners</option>
          {portfolio.length > 0 && (
            <optgroup label="Portfolio companies">
              {portfolio.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label="Other partners">
              {others.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label>
        Status
        <select value={status} onChange={(e) => go({ status: e.target.value })}>
          <option value="">Any status</option>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      {adding ? (
        <form
          className="flex items-end gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (newArtist.trim()) saveArtist(newArtist, true);
          }}
        >
          <label>
            New artist
            <input
              type="search"
              autoFocus
              value={newArtist}
              onChange={(e) => setNewArtist(e.target.value)}
              placeholder="Artist name"
              maxLength={120}
            />
          </label>
          <button type="submit" disabled={!newArtist.trim()} className="btn btn-sm btn-primary">
            Add
          </button>
          <button type="button" onClick={() => setAdding(false)} className="btn btn-sm btn-quiet">
            Cancel
          </button>
        </form>
      ) : (
        <label>
          Artist
          <select
            className="min-w-[180px] max-sm:min-w-0"
            value={artist}
            onChange={(e) => (e.target.value === "__add" ? setAdding(true) : go({ artist: e.target.value }))}
          >
            <option value="">All artists</option>
            {artists.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
            <option value="__add">+ Add an artist…</option>
          </select>
        </label>
      )}
      <label className="ml-auto">
        Sort
        <select value={sort} onChange={(e) => go({ sort: e.target.value === "created" ? "created" : "" })}>
          <option value="edited">Recently edited</option>
          <option value="created">Date created</option>
        </select>
      </label>
      {(q || partner || status || artist) && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            go({ q: "", partner: "", status: "", artist: "" });
          }}
          className="btn btn-quiet btn-sm"
        >
          Clear
        </button>
      )}
      {isManual && (
        <button
          type="button"
          onClick={() => saveArtist(artist, false)}
          className="btn btn-quiet btn-sm"
          title="Takes this hand-added artist out of the Artist list"
        >
          Remove {artist} from the list
        </button>
      )}
      {error && <p className="basis-full text-sm font-bold text-fb-red">{error}</p>}
    </div>
  );
}
