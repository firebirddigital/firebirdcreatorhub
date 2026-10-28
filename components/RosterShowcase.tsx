"use client";

import { useEffect, useMemo, useState } from "react";
import { compact, CPM_OPTIONS, creatorCpm, money } from "@/lib/format";
import {
  listTotals,
  loadLists,
  newListId,
  requestUrlFor,
  saveLists,
  shareUrlFor,
  type RosterList,
} from "@/lib/roster-lists";
import type { Creator } from "@/lib/types";

const UNTAGGED = "More creators";
type View = "cards" | "list";
type Platform = "any" | "tiktok" | "instagram";
type Sort = "reach" | "avgViews" | "name" | "rate" | "cpm";

const FOLLOWER_OPTIONS = [0, 10_000, 50_000, 100_000, 500_000, 1_000_000];
const VIEW_OPTIONS = [0, 5_000, 10_000, 50_000, 100_000, 500_000];

const reach = (c: Creator) => c.instagramFollowers + c.tiktokFollowers;

/**
 * The shareable creators page for partners: black, cards (a row per tag) or a metrics list, filters,
 * and shortlists the partner builds themselves with running totals. Data arrives already stripped of
 * anything private; rates only on the link the team sent "with rates".
 */
export function RosterShowcase({ creators, requestUrl, showRates }: { creators: Creator[]; requestUrl: string; showRates: boolean }) {
  const [query, setQuery] = useState("");
  // Several tags can be picked. "any" = creators with at least one; "all" = creators with every one.
  const [picked, setPicked] = useState<string[]>([]);
  const [matchAll, setMatchAll] = useState(false);
  const toggleTag = (t: string) => setPicked((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const clearTags = () => {
    setPicked([]);
    setMatchAll(false);
  };
  const [view, setView] = useState<View>("cards");
  const [platform, setPlatform] = useState<Platform>("any");
  const [minFollowers, setMinFollowers] = useState(0);
  const [minViews, setMinViews] = useState(0);
  const [maxCpm, setMaxCpm] = useState(0);
  const [sort, setSort] = useState<Sort>("reach");

  // ---- Shortlists (kept in this browser) ----
  const [lists, setLists] = useState<RosterList[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let loaded = loadLists();
    // A shared shortlist link (?list=ids&listName=…) opens with that list loaded.
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("list");
    let active = loaded[0]?.id;
    if (shared) {
      const known = new Set(creators.map((c) => c.id));
      const ids = shared.split(",").filter((id) => known.has(id));
      if (ids.length) {
        const name = (params.get("listName") || "Shared list").slice(0, 60);
        const existing = loaded.find((l) => l.name === name && l.creatorIds.join() === ids.join());
        if (existing) active = existing.id;
        else {
          const list = { id: newListId(), name, creatorIds: ids };
          loaded = [list, ...loaded];
          saveLists(loaded);
          active = list.id;
        }
        setPanelOpen(true);
      }
    }
    setLists(loaded);
    setActiveId(active);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (next: RosterList[]) => {
    setLists(next);
    saveLists(next);
  };
  const active = lists.find((l) => l.id === activeId);
  const byId = useMemo(() => new Map(creators.map((c) => [c.id, c])), [creators]);
  const members = (active?.creatorIds ?? []).map((id) => byId.get(id)).filter((c): c is Creator => Boolean(c));
  const totals = listTotals(members);
  const inList = (id: string) => Boolean(active?.creatorIds.includes(id));

  function toggle(id: string) {
    if (!active) {
      const list = { id: newListId(), name: "My shortlist", creatorIds: [id] };
      update([list, ...lists]);
      setActiveId(list.id);
      return;
    }
    update(
      lists.map((l) =>
        l.id === active.id
          ? { ...l, creatorIds: l.creatorIds.includes(id) ? l.creatorIds.filter((x) => x !== id) : [...l.creatorIds, id] }
          : l,
      ),
    );
  }
  function newList() {
    const name = window.prompt("Name your list", `Shortlist ${lists.length + 1}`)?.trim();
    if (!name) return;
    const list = { id: newListId(), name: name.slice(0, 60), creatorIds: [] };
    update([list, ...lists]);
    setActiveId(list.id);
  }
  function renameList() {
    if (!active) return;
    const name = window.prompt("Rename list", active.name)?.trim();
    if (name) update(lists.map((l) => (l.id === active.id ? { ...l, name: name.slice(0, 60) } : l)));
  }
  function deleteList() {
    if (!active || !window.confirm(`Delete “${active.name}”?`)) return;
    const rest = lists.filter((l) => l.id !== active.id);
    update(rest);
    setActiveId(rest[0]?.id);
    if (!rest.length) setPanelOpen(false);
  }

  // ---- Filtering ----
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [creators]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const followersOn = (c: Creator) =>
      platform === "tiktok" ? c.tiktokFollowers : platform === "instagram" ? c.instagramFollowers : reach(c);
    return creators
      .filter((c) => {
        if (picked.length && !(matchAll ? picked.every((t) => c.tags.includes(t)) : picked.some((t) => c.tags.includes(t))))
          return false;
        if (platform === "tiktok" && !c.tiktok) return false;
        if (platform === "instagram" && !c.instagram) return false;
        if (minFollowers && followersOn(c) < minFollowers) return false;
        if (minViews && (c.avgViews ?? 0) < minViews) return false;
        if (showRates && maxCpm && !((creatorCpm(c) ?? Infinity) <= maxCpm)) return false;
        if (!q) return true;
        return [c.name, c.instagram, c.tiktok, c.location, ...c.tags].some((v) => v?.toLowerCase().includes(q));
      })
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "avgViews"
            ? (b.avgViews ?? 0) - (a.avgViews ?? 0)
            : sort === "rate"
              ? (a.rate ?? Infinity) - (b.rate ?? Infinity)
              : sort === "cpm"
                ? (creatorCpm(a) ?? Infinity) - (creatorCpm(b) ?? Infinity)
              : reach(b) - reach(a),
      );
  }, [creators, query, picked, matchAll, platform, minFollowers, minViews, maxCpm, showRates, sort]);

  // Cards: one row per tag. With "all" (or a single tag), one grid of the matching creators.
  const asGrid = picked.length === 1 || (matchAll && picked.length > 1);
  const sections = useMemo(() => {
    if (asGrid) return [{ title: picked.join(" + "), creators: filtered }].filter((g) => g.creators.length);
    const groups = (picked.length ? picked : tags).map((t) => ({ title: t, creators: filtered.filter((c) => c.tags.includes(t)) }));
    if (!picked.length) {
      const untagged = filtered.filter((c) => !c.tags.length);
      if (untagged.length) groups.push({ title: UNTAGGED, creators: untagged });
    }
    return groups.filter((g) => g.creators.length);
  }, [filtered, tags, picked, asGrid]);

  const filtersOn = Boolean(query || picked.length || platform !== "any" || minFollowers || minViews || maxCpm);
  const showBar = Boolean(active && (members.length > 0 || panelOpen));

  return (
    <div className={`bg-fb-black text-fb-white ${showBar ? "pb-24" : ""}`}>
      <div className="px-[57px] max-sm:px-6">
        <section className="mt-10 flex flex-wrap items-center justify-between gap-6 border-2 border-fb-red p-8 max-sm:p-5">
          <div>
            <h2 className="headline text-4xl max-sm:text-3xl">Want creators like these?</h2>
            <p className="mt-2">Add creators to a list as you browse, then send us a request with it. We&apos;ll take it from there.</p>
          </div>
          <a
            href={active && members.length ? requestUrlFor(requestUrl, active, members, showRates) : requestUrl}
            target="_blank"
            rel="noreferrer"
            className="subtitle bg-fb-red px-7 py-4 text-sm text-fb-white hover:bg-fb-white hover:text-fb-black transition-colors"
          >
            {active && members.length ? "Request with my list" : "Request a campaign"}
          </a>
        </section>

        <div className="mt-14">
          <label className="block">
            <span className="sr-only">Search creators</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search creators, handles, tags"
              className="w-full border-2 border-fb-white bg-fb-black px-4 py-3 text-fb-white placeholder:text-fb-white outline-none focus:border-fb-red"
            />
          </label>
          <div role="group" aria-label="Filter by tag (pick as many as you like)" className="mt-4 flex flex-wrap items-center gap-2">
            {[undefined, ...tags].map((t) => {
              const on = t === undefined ? picked.length === 0 : picked.includes(t);
              return (
                <button
                  key={t ?? "all"}
                  onClick={() => (t === undefined ? clearTags() : toggleTag(t))}
                  aria-pressed={on}
                  className={`subtitle px-4 py-2 text-xs border-2 transition-colors ${
                    on ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-white text-fb-white hover:bg-fb-white hover:text-fb-black"
                  }`}
                >
                  {t ?? "All"}
                </button>
              );
            })}
            {picked.length > 0 && (
              <button onClick={clearTags} className="ml-2 text-sm underline underline-offset-4 hover:text-fb-red">
                Clear tags ({picked.length})
              </button>
            )}
          </div>
          {picked.length > 1 && (
            <div role="group" aria-label="Match tags" className="mt-3 flex items-center gap-3 text-sm">
              <span>Show creators with</span>
              {([false, true] as const).map((all) => (
                <button
                  key={String(all)}
                  onClick={() => setMatchAll(all)}
                  aria-pressed={matchAll === all}
                  className={`subtitle px-3 py-1 text-xs border-2 ${
                    matchAll === all ? "bg-fb-white border-fb-white text-fb-black" : "border-fb-white text-fb-white"
                  }`}
                >
                  {all ? `All ${picked.length} tags` : "Any of these tags"}
                </button>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-4 pb-5">
            <DarkSelect
              label="Platform"
              value={platform}
              onChange={(v) => setPlatform(v as Platform)}
              options={[
                ["any", "Any platform"],
                ["tiktok", "TikTok"],
                ["instagram", "Instagram"],
              ]}
            />
            <DarkSelect
              label="Followers"
              value={String(minFollowers)}
              onChange={(v) => setMinFollowers(Number(v))}
              options={FOLLOWER_OPTIONS.map((v) => [String(v), v ? `${compact(v)}+` : "Any"])}
            />
            <DarkSelect
              label="Median views (last 10 posts)"
              value={String(minViews)}
              onChange={(v) => setMinViews(Number(v))}
              options={VIEW_OPTIONS.map((v) => [String(v), v ? `${compact(v)}+` : "Any"])}
            />
            {showRates && (
              <DarkSelect
                label="CPM"
                value={String(maxCpm)}
                onChange={(v) => setMaxCpm(Number(v))}
                options={CPM_OPTIONS.map((v) => [String(v), v ? `Up to $${v}` : "Any"])}
              />
            )}
            <DarkSelect
              label="Sort"
              value={sort}
              onChange={(v) => setSort(v as Sort)}
              options={[
                ["reach", "Most followers"],
                ["avgViews", "Most median views"],
                ...(showRates
                  ? ([
                      ["rate", "Lowest rate"],
                      ["cpm", "Lowest CPM"],
                    ] as [string, string][])
                  : []),
                ["name", "Name"],
              ]}
            />
            {filtersOn && (
              <button
                onClick={() => {
                  setQuery("");
                  clearTags();
                  setPlatform("any");
                  setMinFollowers(0);
                  setMinViews(0);
                  setMaxCpm(0);
                }}
                className="pb-2 text-sm underline underline-offset-4 hover:text-fb-red"
              >
                Clear filters
              </button>
            )}
            <div role="group" aria-label="View" className="ml-auto flex border-2 border-fb-white">
              {(["cards", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`subtitle px-4 py-2 text-xs ${view === v ? "bg-fb-white text-fb-black" : "text-fb-white"}`}
                >
                  {v === "cards" ? "Cards" : "List"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-fb-red pb-24">
        {filtered.length === 0 ? (
          <p className="px-[57px] max-sm:px-6 pt-10">No creators match those filters.</p>
        ) : view === "list" ? (
          <ListView creators={filtered} showRates={showRates} inList={inList} onToggle={toggle} />
        ) : (
          sections.map((s) => (
            <section key={s.title} className="pt-10">
              <div className="flex items-baseline gap-4 px-[57px] max-sm:px-6">
                <h2 className="headline text-4xl max-sm:text-3xl">{s.title}</h2>
                <span>
                  {s.creators.length} {s.creators.length === 1 ? "creator" : "creators"}
                </span>
              </div>
              <ul
                className={`mt-6 px-[57px] max-sm:px-6 ${
                  asGrid ? "grid gap-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" : "flex gap-6 overflow-x-auto pb-4 snap-x"
                }`}
              >
                {s.creators.map((c) => (
                  <li key={c.id} className={asGrid ? "" : "w-[220px] shrink-0 snap-start"}>
                    <CreatorTile creator={c} showRates={showRates} added={inList(c.id)} onToggle={() => toggle(c.id)} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      {/* Running totals for the active list */}
      {showBar && active && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-fb-red bg-fb-black text-fb-white">
          {panelOpen && (
            <ListPanel
              totals={<Totals totals={totals} showRates={showRates} />}
              lists={lists}
              active={active}
              members={members}
              showRates={showRates}
              onSwitch={setActiveId}
              onNew={newList}
              onRename={renameList}
              onDelete={deleteList}
              onRemove={toggle}
            />
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-[57px] max-sm:px-6 py-2.5">
            <button onClick={() => setPanelOpen((o) => !o)} className="subtitle text-sm underline underline-offset-4 hover:text-fb-red">
              {panelOpen ? "Hide list" : `${active.name} (${members.length})`}
            </button>
            {/* Full totals on wide screens; one line elsewhere so the bar never covers the page */}
            {!panelOpen && (
              <>
                <div className="hidden xl:block">
                  <Totals totals={totals} showRates={showRates} />
                </div>
                <p className="text-sm xl:hidden">
                  {[
                    `${compact(totals.followers)} followers`,
                    totals.withViews ? `${compact(totals.combinedViews)} combined median views` : "",
                    showRates && totals.withRates ? `${money(totals.spend)} spend` : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrlFor(active));
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
                disabled={!members.length}
                className="subtitle border-2 border-fb-white px-3 py-2 text-xs hover:bg-fb-white hover:text-fb-black disabled:opacity-50"
              >
                {copied ? "Link copied" : "Share list"}
              </button>
              <a
                href={members.length ? requestUrlFor(requestUrl, active, members, showRates) : requestUrl}
                target="_blank"
                rel="noreferrer"
                className="subtitle bg-fb-red px-3 py-2 text-xs text-fb-white hover:bg-fb-white hover:text-fb-black"
              >
                Request with this list
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Totals({ totals: t, showRates }: { totals: ReturnType<typeof listTotals>; showRates: boolean }) {
  const items: { label: string; value: string; note?: string }[] = [
    { label: "Followers", value: compact(t.followers) },
    {
      label: "Combined median views",
      value: t.withViews ? compact(t.combinedViews) : "—",
      note: t.withViews ? "if every creator posts once" : undefined,
    },
    { label: "Avg views per creator", value: t.avgViews ? compact(t.avgViews) : "—" },
  ];
  if (showRates) {
    items.push({
      label: "Total spend",
      value: t.withRates ? money(t.spend) : "—",
      note: t.withRates && t.withRates < t.creators ? `from ${t.withRates} of ${t.creators} with rates` : undefined,
    });
    items.push({ label: "Cost per 1K views", value: t.costPer1k !== undefined ? money(t.costPer1k, 2) : "—" });
  }
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-1">
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-xs">{i.label}</dt>
          <dd className="figure text-lg leading-tight">
            {i.value}
            {i.note && <span className="ml-1 font-sans text-xs font-normal">({i.note})</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ListPanel({
  totals,
  lists,
  active,
  members,
  showRates,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onRemove,
}: {
  totals: React.ReactNode;
  lists: RosterList[];
  active: RosterList;
  members: Creator[];
  showRates: boolean;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="max-h-[60vh] overflow-y-auto border-b-2 border-fb-white px-[57px] max-sm:px-6 py-5">
      <div className="mb-5">{totals}</div>
      <div className="flex flex-wrap items-end gap-4">
        <label>
          <span className="text-xs font-bold">Your lists</span>
          <select
            value={active.id}
            onChange={(e) => onSwitch(e.target.value)}
            className="mt-1 block border-b-2 border-fb-white bg-fb-black py-1.5 pr-6 font-bold text-fb-white outline-none focus:border-fb-red"
          >
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.creatorIds.length})
              </option>
            ))}
          </select>
        </label>
        <button onClick={onNew} className="text-sm underline underline-offset-4 hover:text-fb-red">
          New list
        </button>
        <button onClick={onRename} className="text-sm underline underline-offset-4 hover:text-fb-red">
          Rename
        </button>
        <button onClick={onDelete} className="text-sm underline underline-offset-4 hover:text-fb-red">
          Delete
        </button>
        <span className="text-xs">Lists are saved in this browser. Use Share list to send one to a colleague.</span>
      </div>
      {members.length === 0 ? (
        <p className="mt-4 text-sm">This list is empty. Use “Add to list” on any creator.</p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-fb-white text-left text-xs">
              <th className="py-2 pr-4">Creator</th>
              <th className="py-2 pr-4 text-right">Followers</th>
              <th className="py-2 pr-4 text-right">Median views</th>
              {showRates && <th className="py-2 pr-4 text-right">Rate</th>}
              {showRates && <th className="py-2 pr-4 text-right">CPM</th>}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {members.map((c) => (
              <tr key={c.id} className="border-b border-fb-white">
                <td className="py-2 pr-4 font-bold">{c.name}</td>
                <td className="py-2 pr-4 text-right figure text-base">{compact(reach(c))}</td>
                <td className="py-2 pr-4 text-right figure text-base">{c.avgViews ? compact(c.avgViews) : "—"}</td>
                {showRates && <td className="py-2 pr-4 text-right">{c.rate ? money(c.rate) : "—"}</td>}
                {showRates && <td className="py-2 pr-4 text-right">{creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}</td>}
                <td className="py-2 text-right">
                  <button onClick={() => onRemove(c.id)} className="text-xs underline underline-offset-2 hover:text-fb-red">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ListView({
  creators,
  showRates,
  inList,
  onToggle,
}: {
  creators: Creator[];
  showRates: boolean;
  inList: (id: string) => boolean;
  onToggle: (id: string) => void;
}) {
  const th = "py-3 pr-4 text-left text-xs font-bold whitespace-nowrap";
  return (
    <div className="overflow-x-auto px-[57px] max-sm:px-6 pt-6">
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="border-b-2 border-fb-white">
            <th className={th}>Creator</th>
            <th className={`${th} text-right`}>TikTok</th>
            <th className={`${th} text-right`}>Instagram</th>
            <th className={`${th} text-right`}>
              Median views<span className="block font-normal">last 10 posts</span>
            </th>
            {showRates && <th className={`${th} text-right`}>Rate</th>}
            {showRates && (
              <th className={`${th} text-right`} title="Rate ÷ median views (last 10 posts) × 1,000">
                CPM
              </th>
            )}
            <th className={th}>Tags</th>
            <th className={th} />
          </tr>
        </thead>
        <tbody>
          {creators.map((c) => (
            <tr key={c.id} className="border-b border-fb-white align-top">
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
              {showRates && <td className="py-3 pr-4 text-right whitespace-nowrap">{c.rate ? money(c.rate) : "—"}</td>}
              {showRates && (
                <td className="py-3 pr-4 text-right whitespace-nowrap">{creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}</td>
              )}
              <td className="py-3 pr-4 text-xs">{c.tags.join(", ")}</td>
              <td className="py-3 text-right">
                <AddButton added={inList(c.id)} onClick={() => onToggle(c.id)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AddButton({ added, onClick }: { added: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={added}
      className={`subtitle whitespace-nowrap px-3 py-1.5 text-xs border-2 transition-colors ${
        added ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-white text-fb-white hover:bg-fb-white hover:text-fb-black"
      }`}
    >
      {added ? "✓ In list" : "+ Add to list"}
    </button>
  );
}

function CreatorTile({
  creator: c,
  showRates,
  added,
  onToggle,
}: {
  creator: Creator;
  showRates: boolean;
  added: boolean;
  onToggle: () => void;
}) {
  // Tap opens their bigger platform, so partners see the creator's actual content.
  const tiktokFirst = c.tiktok && (!c.instagram || c.tiktokFollowers >= c.instagramFollowers);
  const href = tiktokFirst
    ? `https://www.tiktok.com/@${c.tiktok}`
    : c.instagram
      ? `https://www.instagram.com/${c.instagram}/`
      : undefined;
  const handle = tiktokFirst ? c.tiktok : c.instagram;
  const initials = c.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter((ch) => ch && /[A-Za-z0-9]/.test(ch))
    .slice(0, 2)
    .join("");

  const picture = (
    <div className={`group relative aspect-[4/5] overflow-hidden bg-fb-black ${c.photo ? "" : "border-2 border-fb-white"}`}>
      {c.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.photo} alt="" className="bw absolute inset-0 h-full w-full object-cover" loading="lazy" />
      ) : (
        // White initials (the headline style is red by default)
        <span aria-hidden className="absolute inset-0 flex items-end p-4 pb-6 headline text-6xl" style={{ color: "#ffffff" }}>
          {initials}
        </span>
      )}
      {href && (
        <span
          aria-hidden
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-fb-red text-fb-white transition-transform group-hover:scale-110"
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1.5 bg-fb-red" />
    </div>
  );

  return (
    <article>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label={`${c.name} on ${tiktokFirst ? "TikTok" : "Instagram"}`}>
          {picture}
        </a>
      ) : (
        picture
      )}
      <h3 className="subtitle mt-3 text-base leading-tight">{c.name}</h3>
      {handle && <p className="text-sm">@{handle}</p>}
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div>
          <dt className="text-xs">Followers</dt>
          <dd className="figure text-lg">{reach(c) ? compact(reach(c)) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs">Median views</dt>
          <dd className="figure text-lg">{c.avgViews ? compact(c.avgViews) : "—"}</dd>
        </div>
        {showRates && (
          <div>
            <dt className="text-xs">Rate</dt>
            <dd className="figure text-lg">{c.rate ? money(c.rate) : "—"}</dd>
          </div>
        )}
        {showRates && (
          <div title="Rate ÷ median views (last 10 posts) × 1,000">
            <dt className="text-xs">CPM</dt>
            <dd className="figure text-lg">{creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}</dd>
          </div>
        )}
      </dl>
      <div className="mt-3">
        <AddButton added={added} onClick={onToggle} />
      </div>
    </article>
  );
}

function DarkSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block border-b-2 border-fb-white bg-fb-black py-2 pr-6 font-bold text-fb-white outline-none focus:border-fb-red"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
