"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { compact, CPM_OPTIONS, creatorCpm, money, timeAgo } from "@/lib/format";
import { pullStatsInBatches } from "@/lib/pull-stats";
import type { Creator, TrackRecord } from "@/lib/types";
import { trackRecordRatio, trackRecordText } from "./TrackRecordLine";

type PlatformFilter = "any" | "instagram" | "tiktok";
type Sort = "reach" | "avgViews" | "track" | "stale" | "name" | "rate" | "cpm";
type View = "cards" | "table";

const REACH_OPTIONS = [
  { label: "Any reach", value: 0 },
  { label: "10K+", value: 10_000 },
  { label: "50K+", value: 50_000 },
  { label: "100K+", value: 100_000 },
  { label: "500K+", value: 500_000 },
  { label: "1M+", value: 1_000_000 },
];

const AVG_VIEWS_OPTIONS = [
  { label: "Any views", value: 0 },
  { label: "5K+", value: 5_000 },
  { label: "10K+", value: 10_000 },
  { label: "50K+", value: 50_000 },
  { label: "100K+", value: 100_000 },
  { label: "500K+", value: 500_000 },
];

const RATE_OPTIONS = [
  { label: "Any rate", value: 0 },
  { label: "Up to $250", value: 250 },
  { label: "Up to $500", value: 500 },
  { label: "Up to $1,000", value: 1_000 },
  { label: "Up to $2,500", value: 2_500 },
  { label: "Up to $5,000", value: 5_000 },
];

const reach = (c: Creator, platform: PlatformFilter) =>
  platform === "instagram"
    ? c.instagramFollowers
    : platform === "tiktok"
      ? c.tiktokFollowers
      : c.instagramFollowers + c.tiktokFollowers;

async function saveTags(updates: { id: string; tags: string[] }[]) {
  const res = await fetch("/api/creators", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ updates }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? "Tags didn't save. Try again.");
}

export function CreatorBrowser({
  creators: initial,
  trackRecords = {},
  editable,
  audience = "team",
}: {
  creators: Creator[];
  trackRecords?: Record<string, TrackRecord>;
  editable: boolean;
  /** "partner" is the shareable roster link: no rates, track records, downloads or editing. */
  audience?: "team" | "partner";
}) {
  const team = audience === "team";
  const router = useRouter();
  // Tag edits show straight away; the server copy catches up on the next refresh.
  const [tagEdits, setTagEdits] = useState<Record<string, string[]>>({});
  const creators = useMemo(
    () => initial.map((c) => (tagEdits[c.id] ? { ...c, tags: tagEdits[c.id] } : c)),
    [initial, tagEdits],
  );

  const [view, setView] = useState<View>("table");
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [platform, setPlatform] = useState<PlatformFilter>("any");
  const [minReach, setMinReach] = useState(0);
  const [minAvgViews, setMinAvgViews] = useState(0);
  const [maxRate, setMaxRate] = useState(0);
  const [maxCpm, setMaxCpm] = useState(0);
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState<Sort>("reach");
  const [selected, setSelected] = useState<string[]>([]);
  const [pulling, setPulling] = useState<{ done: number; total: number }>();
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [creators]);
  const untaggedCount = creators.filter((c) => !c.tags.length).length;

  const locations = useMemo(
    () => [...new Set(creators.map((c) => c.location).filter((l): l is string => Boolean(l)))].sort(),
    [creators],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    return creators
      .filter((c) => {
        if (untaggedOnly && c.tags.length) return false;
        if (tags.length && !(matchAll ? tags.every((t) => c.tags.includes(t)) : tags.some((t) => c.tags.includes(t))))
          return false;
        if (platform === "instagram" && !c.instagram) return false;
        if (platform === "tiktok" && !c.tiktok) return false;
        if (reach(c, platform) < minReach) return false;
        if (minAvgViews && (c.avgViews ?? 0) < minAvgViews) return false;
        if (maxRate && (!c.rate || c.rate > maxRate)) return false;
        if (maxCpm && !((creatorCpm(c) ?? Infinity) <= maxCpm)) return false;
        if (location && c.location !== location) return false;
        if (!q) return true;
        return [c.name, c.instagram, c.tiktok, c.location, c.notes, ...c.tags]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "rate"
            ? (a.rate ?? Infinity) - (b.rate ?? Infinity)
            : sort === "cpm"
            ? (creatorCpm(a) ?? Infinity) - (creatorCpm(b) ?? Infinity)
            : sort === "avgViews"
              ? (b.avgViews ?? 0) - (a.avgViews ?? 0)
              : sort === "track"
                ? trackRecordRatio(trackRecords[b.id]) - trackRecordRatio(trackRecords[a.id]) ||
                  (trackRecords[b.id]?.views ?? 0) - (trackRecords[a.id]?.views ?? 0)
                : sort === "stale"
                  ? (a.statsUpdated ?? "").localeCompare(b.statsUpdated ?? "")
                  : reach(b, platform) - reach(a, platform),
      );
  }, [creators, query, tags, matchAll, untaggedOnly, platform, minReach, minAvgViews, maxRate, maxCpm, location, sort, trackRecords]);

  const toggleTag = (t: string) => {
    setUntaggedOnly(false);
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };
  const filtersOn = Boolean(
    query || tags.length || untaggedOnly || platform !== "any" || minReach || minAvgViews || maxRate || maxCpm || location,
  );
  const clearFilters = () => {
    setQuery("");
    setTags([]);
    setUntaggedOnly(false);
    setPlatform("any");
    setMinReach(0);
    setMinAvgViews(0);
    setMaxRate(0);
    setMaxCpm(0);
    setLocation("");
  };

  /** Applies tag changes locally, saves them, and rolls back if the save fails. */
  async function applyTags(updates: { id: string; tags: string[] }[], done: string) {
    const before = Object.fromEntries(updates.map((u) => [u.id, creators.find((c) => c.id === u.id)?.tags ?? []]));
    setTagEdits((cur) => ({ ...cur, ...Object.fromEntries(updates.map((u) => [u.id, u.tags])) }));
    setMessage(undefined);
    try {
      await saveTags(updates);
      setMessage({ text: done });
      router.refresh();
    } catch (e) {
      setTagEdits((cur) => ({ ...cur, ...before }));
      setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
    }
  }

  function exportCsv() {
    const rows = [
      ["Name", "Instagram", "Instagram followers", "TikTok", "TikTok followers", "Median views (last 10 posts)", "Tags", "Location", "Rate", "CPM", "Email"],
      ...shown.map((c) => [
        c.name,
        c.instagram ? `@${c.instagram}` : "",
        String(c.instagramFollowers || ""),
        c.tiktok ? `@${c.tiktok}` : "",
        String(c.tiktokFollowers || ""),
        c.avgViews ? String(c.avgViews) : "",
        c.tags.join("; "),
        c.location ?? "",
        c.rate ? String(c.rate) : "",
        creatorCpm(c)?.toFixed(2) ?? "",
        c.email ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `creators${tags.length ? `-${tags.join("-").toLowerCase()}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const shownIds = shown.map((c) => c.id);
  const selectedShown = selected.filter((id) => shownIds.includes(id));

  return (
    <div className="mt-12">
      <div className="md:sticky md:top-0 z-10 bg-fb-white border-y-2 border-fb-black py-5 space-y-5">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <label className="flex-1 min-w-60">
            <span className="sr-only">Search creators</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, handle, city or notes"
              className="w-full border-b-2 border-fb-black bg-transparent py-2 text-lg outline-none focus:border-fb-red"
            />
          </label>
          <Select
            label="Platform"
            value={platform}
            onChange={(v) => setPlatform(v as PlatformFilter)}
            options={[
              { label: "Any platform", value: "any" },
              { label: "Instagram", value: "instagram" },
              { label: "TikTok", value: "tiktok" },
            ]}
          />
          <Select
            label="Followers"
            value={String(minReach)}
            onChange={(v) => setMinReach(Number(v))}
            options={REACH_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
          />
          <Select
            label="Median views (last 10)"
            value={String(minAvgViews)}
            onChange={(v) => setMinAvgViews(Number(v))}
            options={AVG_VIEWS_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
          />
          {team && (
            <Select
              label="Rate"
              value={String(maxRate)}
              onChange={(v) => setMaxRate(Number(v))}
              options={RATE_OPTIONS.map((o) => ({ label: o.label, value: String(o.value) }))}
            />
          )}
          {team && (
            <Select
              label="CPM"
              value={String(maxCpm)}
              onChange={(v) => setMaxCpm(Number(v))}
              options={CPM_OPTIONS.map((v) => ({ label: v ? `Up to $${v}` : "Any CPM", value: String(v) }))}
            />
          )}
          {locations.length > 0 && (
            <Select
              label="Location"
              value={location}
              onChange={setLocation}
              options={[{ label: "Anywhere", value: "" }, ...locations.map((l) => ({ label: l, value: l }))]}
            />
          )}
          <Select
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { label: "Biggest reach", value: "reach" },
              { label: "Most median views", value: "avgViews" },
              ...(team
                ? [
                    { label: "Best track record", value: "track" },
                    { label: "Oldest stats first", value: "stale" },
                    { label: "Lowest rate", value: "rate" },
                    { label: "Lowest CPM", value: "cpm" },
                  ]
                : []),
              { label: "Name", value: "name" },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filter by tag" className="flex flex-wrap gap-2">
            {allTags.map(([t, count]) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTag(t)}
                  aria-pressed={on}
                  className={`px-3 py-1.5 text-sm font-bold border-2 transition-colors ${
                    on ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-black hover:bg-fb-black hover:text-fb-white"
                  }`}
                >
                  {t} <span className="font-normal">{count}</span>
                </button>
              );
            })}
            {untaggedCount > 0 && (
              <button
                onClick={() => {
                  setTags([]);
                  setUntaggedOnly((v) => !v);
                }}
                aria-pressed={untaggedOnly}
                className={`px-3 py-1.5 text-sm font-bold border-2 border-dashed transition-colors ${
                  untaggedOnly ? "bg-fb-black border-fb-black text-fb-white" : "border-fb-black hover:bg-fb-black hover:text-fb-white"
                }`}
              >
                Needs tags <span className="font-normal">{untaggedCount}</span>
              </button>
            )}
          </div>
          {tags.length > 1 && (
            <label className="ml-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={matchAll} onChange={(e) => setMatchAll(e.target.checked)} className="size-4 accent-fb-red" />
              Must have all {tags.length}
            </label>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="figure text-2xl">
            {shown.length} <span className="font-sans font-normal text-base tracking-normal">of {creators.length} creators</span>
          </p>
          {team && <StatsFreshness creators={creators} />}
        </div>
        <div className="flex flex-wrap items-center gap-6 text-sm">
          {filtersOn && (
            <button onClick={clearFilters} className="underline underline-offset-4 hover:text-fb-red">
              Clear filters
            </button>
          )}
          {team && (
            <button onClick={exportCsv} disabled={!shown.length} className="font-bold underline underline-offset-4 hover:text-fb-red">
              Download this list
            </button>
          )}
          <div role="group" aria-label="View" className="flex border-2 border-fb-black">
            {(["table", "cards"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-3 py-1 font-bold ${view === v ? "bg-fb-black text-fb-white" : "hover:bg-fb-black/10"}`}
              >
                {v === "table" ? "Table" : "Cards"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {editable && view === "table" && selectedShown.length > 0 && (
        <BulkTagBar
          count={selectedShown.length}
          allTags={allTags.map(([t]) => t)}
          onApply={(tag, mode) => {
            const updates = creators
              .filter((c) => selectedShown.includes(c.id))
              .map((c) => ({
                id: c.id,
                tags: mode === "add" ? [...new Set([...c.tags, tag])] : c.tags.filter((t) => t !== tag),
              }));
            applyTags(
              updates,
              `${mode === "add" ? "Added" : "Removed"} “${tag}” ${mode === "add" ? "to" : "from"} ${updates.length} ${
                updates.length === 1 ? "creator" : "creators"
              }.`,
            );
          }}
          onClear={() => setSelected([])}
          pulling={pulling}
          onPullStats={async () => {
            const ids = selectedShown;
            setPulling({ done: 0, total: ids.length });
            setMessage(undefined);
            try {
              const r = await pullStatsInBatches(ids, (done) => setPulling({ done, total: ids.length }));
              const missed = r.requested - r.updated;
              setMessage({
                text: `Pulled followers and median views (last 10 posts) for ${r.updated} of ${r.requested} creators.${
                  missed ? ` ${missed} had no public TikTok or Instagram to read.` : ""
                }`,
              });
              router.refresh();
            } catch (e) {
              setMessage({ text: e instanceof Error ? e.message : String(e), error: true });
            } finally {
              setPulling(undefined);
            }
          }}
        />
      )}
      {message && (
        <p role="status" className={`mt-4 text-sm ${message.error ? "text-fb-red font-bold" : ""}`}>
          {message.text}
        </p>
      )}

      {!shown.length ? (
        <p className="mt-10 max-w-prose">No creators match these filters. Remove a tag or loosen a filter.</p>
      ) : view === "table" ? (
        <CreatorTable
          creators={shown}
          team={team}
          trackRecords={trackRecords}
          activeTags={tags}
          allTags={allTags.map(([t]) => t)}
          editable={editable}
          selected={selectedShown}
          onSelect={(ids, on) =>
            setSelected((cur) => (on ? [...new Set([...cur, ...ids])] : cur.filter((id) => !ids.includes(id))))
          }
          onTags={(c, next) => applyTags([{ id: c.id, tags: next }], `Saved tags for ${c.name}.`)}
        />
      ) : (
        <ul className="mt-8 grid gap-x-8 gap-y-12 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
          {shown.map((c) => (
            <li key={c.id}>
              <CreatorCard creator={c} activeTags={tags} trackRecord={team ? trackRecordText(trackRecords[c.id]) : undefined} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BulkTagBar({
  count,
  allTags,
  onApply,
  onClear,
  pulling,
  onPullStats,
}: {
  count: number;
  allTags: string[];
  onApply: (tag: string, mode: "add" | "remove") => void;
  onClear: () => void;
  pulling?: { done: number; total: number };
  onPullStats: () => void;
}) {
  const [tag, setTag] = useState("");
  const t = tag.trim();
  return (
    <div className="mt-4 flex flex-wrap items-end gap-4 border-2 border-fb-red p-4">
      <p className="font-bold">
        {count} selected
      </p>
      <label className="min-w-48 flex-1">
        <span className="text-xs font-bold">Tag</span>
        <input
          list="creator-tag-options"
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="Pick or type a tag"
          className="mt-1 block w-full border-b-2 border-fb-black bg-transparent py-1.5 outline-none focus:border-fb-red"
        />
        <datalist id="creator-tag-options">
          {allTags.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </label>
      <button
        disabled={!t}
        onClick={() => onApply(t, "add")}
        className="subtitle bg-fb-red text-fb-white px-4 py-2 text-sm hover:bg-fb-black transition-colors disabled:opacity-50"
      >
        Add tag
      </button>
      <button
        disabled={!t}
        onClick={() => onApply(t, "remove")}
        className="subtitle border-2 border-fb-black px-4 py-1.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50"
      >
        Remove tag
      </button>
      <button
        onClick={onPullStats}
        disabled={Boolean(pulling)}
        title="Followers and median views across their last 10 posts. Uses a little Apify credit per creator."
        className="subtitle border-2 border-fb-black px-4 py-1.5 text-sm hover:bg-fb-black hover:text-fb-white transition-colors disabled:opacity-50"
      >
        {pulling ? `Pulling stats ${pulling.done} of ${pulling.total}` : "Pull stats"}
      </button>
      <button onClick={onClear} className="text-sm underline underline-offset-4">
        Clear selection
      </button>
    </div>
  );
}

function CreatorTable({
  creators,
  team,
  trackRecords,
  activeTags,
  allTags,
  editable,
  selected,
  onSelect,
  onTags,
}: {
  creators: Creator[];
  team: boolean;
  trackRecords: Record<string, TrackRecord>;
  activeTags: string[];
  allTags: string[];
  editable: boolean;
  selected: string[];
  onSelect: (ids: string[], on: boolean) => void;
  onTags: (c: Creator, tags: string[]) => void;
}) {
  const allOn = creators.every((c) => selected.includes(c.id));
  const th = "py-2 pr-4 text-left text-xs font-bold whitespace-nowrap";
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[1160px] border-t-2 border-fb-black text-sm">
        <thead>
          <tr className="border-b-2 border-fb-black">
            {editable && (
              <th className="py-2 pr-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Select all shown"
                  checked={allOn}
                  onChange={(e) => onSelect(creators.map((c) => c.id), e.target.checked)}
                  className="size-4 accent-fb-red"
                />
              </th>
            )}
            <th className={th}>Creator</th>
            <th className={`${th} text-right`}>TikTok</th>
            <th className={`${th} text-right`}>Instagram</th>
            <th className={`${th} text-right`} title="Median views across their last 10 posts">Median views<span className="block font-normal">last 10 posts</span></th>
            {team && <th className={`${th} text-right`}>Rate</th>}
            {team && (
              <th className={`${th} text-right`} title="Rate ÷ median views (last 10 posts) × 1,000">
                CPM
              </th>
            )}
            {team && <th className={th} title="Across all Firebird campaigns">Track record</th>}
            {team && (
              <th className={th} title="Followers and median views. Refreshed automatically every night, oldest first.">
                Stats updated
              </th>
            )}
            <th className={th}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {creators.map((c) => (
            <tr key={c.id} className="border-b border-fb-black/20 align-top">
              {editable && (
                <td className="py-3 pr-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${c.name}`}
                    checked={selected.includes(c.id)}
                    onChange={(e) => onSelect([c.id], e.target.checked)}
                    className="size-4 accent-fb-red"
                  />
                </td>
              )}
              <td className="py-3 pr-4">
                <p className="font-bold">{c.name}</p>
                {c.location && <p className="text-xs">{c.location}</p>}
              </td>
              <td className="py-3 pr-4 text-right whitespace-nowrap">
                {c.tiktok ? (
                  <a href={`https://www.tiktok.com/@${c.tiktok}`} target="_blank" rel="noreferrer" className="hover:text-fb-red">
                    <span className="figure text-base">{c.tiktokFollowers ? compact(c.tiktokFollowers) : "—"}</span>
                    <span className="block text-xs">@{c.tiktok}</span>
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-3 pr-4 text-right whitespace-nowrap">
                {c.instagram ? (
                  <a href={`https://www.instagram.com/${c.instagram}/`} target="_blank" rel="noreferrer" className="hover:text-fb-red">
                    <span className="figure text-base">{c.instagramFollowers ? compact(c.instagramFollowers) : "—"}</span>
                    <span className="block text-xs">@{c.instagram}</span>
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-3 pr-4 text-right figure text-base">{c.avgViews ? compact(c.avgViews) : "—"}</td>
              {team && <td className="py-3 pr-4 text-right whitespace-nowrap">{c.rate ? money(c.rate) : "—"}</td>}
              {team && <td className="py-3 pr-4 text-right whitespace-nowrap">{creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}</td>}
              {team && <td className="py-3 pr-4 text-xs">{trackRecordText(trackRecords[c.id]) ?? "No campaigns yet"}</td>}
              {team && (
                <td className="py-3 pr-4 text-xs whitespace-nowrap" title={c.statsUpdated ? new Date(c.statsUpdated).toLocaleString("en-US") : undefined}>
                  {c.tiktok || c.instagram ? (c.statsUpdated ? updatedLabel(c.statsUpdated) : "Never") : "No handle"}
                </td>
              )}
              <td className="py-3 min-w-64">
                <TagCell creator={c} activeTags={activeTags} allTags={allTags} editable={editable} onTags={onTags} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagCell({
  creator: c,
  activeTags,
  allTags,
  editable,
  onTags,
}: {
  creator: Creator;
  activeTags: string[];
  allTags: string[];
  editable: boolean;
  onTags: (c: Creator, tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  // Enter submits and the input then blurs as it closes; only the first one should save.
  const committed = useRef(false);
  const listId = `tags-${c.id}`;

  function add() {
    if (committed.current) return;
    committed.current = true;
    const t = draft.trim();
    setDraft("");
    setAdding(false);
    if (t && !c.tags.includes(t)) onTags(c, [...c.tags, t]);
  }

  return (
    <ul className="flex flex-wrap items-center gap-1.5">
      {c.tags.map((t) => (
        <li
          key={t}
          className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 ${
            activeTags.includes(t) ? "bg-fb-red text-fb-white" : "border border-fb-black"
          }`}
        >
          {t}
          {editable && (
            <button
              onClick={() => onTags(c, c.tags.filter((x) => x !== t))}
              aria-label={`Remove ${t} from ${c.name}`}
              className="leading-none opacity-60 hover:opacity-100"
            >
              ×
            </button>
          )}
        </li>
      ))}
      {!c.tags.length && <li className="text-xs italic">No tags</li>}
      {editable && (
        <li>
          {adding ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                autoFocus
                list={listId}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={add}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  committed.current = true;
                  setDraft("");
                  setAdding(false);
                }}
                placeholder="Tag"
                aria-label={`Add a tag to ${c.name}`}
                className="w-28 border-b-2 border-fb-black bg-transparent py-0.5 text-xs outline-none focus:border-fb-red"
              />
              <datalist id={listId}>
                {allTags
                  .filter((t) => !c.tags.includes(t))
                  .map((t) => (
                    <option key={t} value={t} />
                  ))}
              </datalist>
            </form>
          ) : (
            <button
              onClick={() => {
                committed.current = false;
                setAdding(true);
              }}
              aria-label={`Add a tag to ${c.name}`}
              className="text-xs font-bold px-2 py-0.5 border border-dashed border-fb-black hover:bg-fb-black hover:text-fb-white"
            >
              + Tag
            </button>
          )}
        </li>
      )}
    </ul>
  );
}

function CreatorCard({ creator: c, activeTags, trackRecord }: { creator: Creator; activeTags: string[]; trackRecord?: string }) {
  const initials = c.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");

  return (
    <article>
      <div className="relative aspect-[4/5] bg-fb-black overflow-hidden">
        {c.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.photo} alt="" className="bw absolute inset-0 h-full w-full object-cover" loading="lazy" />
        ) : (
          <span aria-hidden className="absolute inset-0 flex items-end p-5 headline text-fb-white text-7xl">
            {initials}
          </span>
        )}
      </div>
      <h3 className="subtitle mt-4 text-xl">{c.name}</h3>
      {c.location && <p className="text-sm">{c.location}</p>}

      <dl className="mt-3 border-t-2 border-fb-black">
        {c.tiktok && <Handle platform="TikTok" handle={c.tiktok} followers={c.tiktokFollowers} href={`https://www.tiktok.com/@${c.tiktok}`} />}
        {c.instagram && (
          <Handle platform="Instagram" handle={c.instagram} followers={c.instagramFollowers} href={`https://www.instagram.com/${c.instagram}/`} />
        )}
        {c.avgViews ? (
          <div className="flex items-baseline justify-between gap-3 border-b border-fb-black/20 py-2">
            <dt className="text-sm font-bold">Median views <span className="font-normal">(last 10 posts)</span></dt>
            <dd className="figure text-lg">{compact(c.avgViews)}</dd>
          </div>
        ) : null}
      </dl>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {c.tags.map((t) => (
          <li
            key={t}
            className={`text-xs font-bold px-2 py-0.5 ${activeTags.includes(t) ? "bg-fb-red text-fb-white" : "border border-fb-black"}`}
          >
            {t}
          </li>
        ))}
      </ul>
      {c.rate && (
        <p className="mt-3 text-sm">
          Rate {money(c.rate)} per post
          {creatorCpm(c) !== undefined && <> · CPM {money(creatorCpm(c)!, 2)}</>}
        </p>
      )}
      {trackRecord && <p className="mt-1 text-sm">Track record: {trackRecord}</p>}
      {c.statsUpdated && <p className="mt-1 text-xs">Stats updated {updatedLabel(c.statsUpdated)}</p>}
    </article>
  );
}

function Handle({ platform, handle, followers, href }: { platform: string; handle: string; followers: number; href: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-fb-black/20 py-2">
      <dt className="min-w-0 text-sm truncate">
        <a href={href} target="_blank" rel="noreferrer" className="hover:text-fb-red">
          <span className="font-bold">{platform}</span> @{handle}
        </a>
      </dt>
      <dd className="figure text-lg">{followers ? compact(followers) : "—"}</dd>
    </div>
  );
}

/** "today", "yesterday", "3d ago". */
function updatedLabel(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : timeAgo(iso);
}

/** How current the roster's stats are, for the team. */
function StatsFreshness({ creators }: { creators: Creator[] }) {
  const withHandles = creators.filter((c) => c.tiktok || c.instagram);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const fresh = withHandles.filter((c) => c.statsUpdated && new Date(c.statsUpdated).getTime() >= weekAgo).length;
  const never = withHandles.filter((c) => !c.statsUpdated).length;
  return (
    <p className="mt-1 text-xs" title="About 3am Nashville time: creators never updated or not updated in 14 days, oldest first, within the Apify budget.">
      Stats refresh automatically every night, oldest first. {fresh} of {withHandles.length} updated this week
      {never ? `, ${never} never updated` : ""}.
    </p>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block border-b-2 border-fb-black bg-transparent py-2 pr-6 font-bold outline-none focus:border-fb-red"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
