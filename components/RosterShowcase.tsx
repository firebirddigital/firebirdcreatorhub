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
 * The shareable creators page for partners: cards (a row per tag) or a metrics list, filters,
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
    <div className={showBar ? "pb-24" : ""}>
      <section className="card hero mt-8 flex flex-wrap items-center justify-between gap-6 px-7 py-6 max-sm:px-5">
        <div>
          <h2 className="headline text-2xl max-sm:text-xl">Want creators like these?</h2>
          <p className="mt-2 text-secondary">Add creators to a list as you browse, then send us a request with it. We&apos;ll take it from there.</p>
        </div>
        <a
          href={active && members.length ? requestUrlFor(requestUrl, active, members, showRates) : requestUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary px-5 py-2.5 text-sm"
        >
          {active && members.length ? "Request with my list" : "Request a campaign"}
        </a>
      </section>

      <section className="card mt-3.5" aria-label="Filters">
        <label className="block">
          <span className="sr-only">Search creators</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search creators, handles, tags"
            className="field placeholder:text-muted"
          />
        </label>
        <div role="group" aria-label="Filter by tag (pick as many as you like)" className="mt-3.5 flex flex-wrap items-center gap-2">
          {[undefined, ...tags].map((t) => {
            const on = t === undefined ? picked.length === 0 : picked.includes(t);
            return (
              <button
                key={t ?? "all"}
                onClick={() => (t === undefined ? clearTags() : toggleTag(t))}
                aria-pressed={on}
                className={`pill cursor-pointer px-3 py-1.5 text-[11px] transition-colors ${
                  on
                    ? "border-fb-red bg-fb-red text-white"
                    : "bg-transparent text-secondary hover:bg-wash-neutral hover:text-fb-black"
                }`}
              >
                {t ?? "All"}
              </button>
            );
          })}
          {picked.length > 0 && (
            <button onClick={clearTags} className="btn btn-quiet btn-sm ml-1">
              Clear tags ({picked.length})
            </button>
          )}
        </div>
        {picked.length > 1 && (
          <div role="group" aria-label="Match tags" className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>Show creators with</span>
            <div className="seg">
              {([false, true] as const).map((all) => (
                <button key={String(all)} onClick={() => setMatchAll(all)} aria-pressed={matchAll === all}>
                  {all ? `All ${picked.length} tags` : "Any of these tags"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="filter-row mt-4 mb-0 border-b-0 border-t border-line pt-4 pb-0">
          <FilterSelect
            label="Platform"
            value={platform}
            onChange={(v) => setPlatform(v as Platform)}
            options={[
              ["any", "Any platform"],
              ["tiktok", "TikTok"],
              ["instagram", "Instagram"],
            ]}
          />
          <FilterSelect
            label="Followers"
            value={String(minFollowers)}
            onChange={(v) => setMinFollowers(Number(v))}
            options={FOLLOWER_OPTIONS.map((v) => [String(v), v ? `${compact(v)}+` : "Any"])}
          />
          <FilterSelect
            label="Median views (last 10 posts)"
            value={String(minViews)}
            onChange={(v) => setMinViews(Number(v))}
            options={VIEW_OPTIONS.map((v) => [String(v), v ? `${compact(v)}+` : "Any"])}
          />
          {showRates && (
            <FilterSelect
              label="CPM"
              value={String(maxCpm)}
              onChange={(v) => setMaxCpm(Number(v))}
              options={CPM_OPTIONS.map((v) => [String(v), v ? `Up to $${v}` : "Any"])}
            />
          )}
          <FilterSelect
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
              className="btn btn-quiet btn-sm"
            >
              Clear filters
            </button>
          )}
          <div role="group" aria-label="View" className="seg ml-auto">
            {(["cards", "list"] as const).map((v) => (
              <button key={v} onClick={() => setView(v)} aria-pressed={view === v}>
                {v === "cards" ? "Cards" : "List"}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="pb-10">
        {filtered.length === 0 ? (
          <div className="card mt-3.5">
            <p className="empty">No creators match those filters.</p>
          </div>
        ) : view === "list" ? (
          <ListView creators={filtered} showRates={showRates} inList={inList} onToggle={toggle} />
        ) : (
          sections.map((s) => (
            <section key={s.title}>
              <div className="flex items-center gap-3">
                <h2 className="section-title flex-1">{s.title}</h2>
                <span className="mt-3.5 text-xs text-muted">
                  {s.creators.length} {s.creators.length === 1 ? "creator" : "creators"}
                </span>
              </div>
              <ul
                className={
                  asGrid
                    ? "grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]"
                    : "-mx-1 flex gap-3.5 overflow-x-auto px-1 pt-1 pb-5 snap-x"
                }
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
        <div className="fixed inset-x-0 bottom-0 z-20 bg-surface text-fb-black shadow-[inset_0_2px_0_var(--red),0_-8px_24px_rgba(0,0,5,0.12)]">
          <div className="mx-auto max-w-[1240px] px-7 max-sm:px-4">
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
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2.5">
              <button onClick={() => setPanelOpen((o) => !o)} className="btn btn-quiet btn-sm -ml-2.5">
                {panelOpen ? "Hide list" : `${active.name} (${members.length})`}
              </button>
              {/* Full totals on wide screens; one line elsewhere so the bar never covers the page */}
              {!panelOpen && (
                <>
                  <div className="hidden xl:block">
                    <Totals totals={totals} showRates={showRates} />
                  </div>
                  <p className="text-sm text-secondary xl:hidden">
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
                  className="btn btn-sm"
                >
                  {copied ? "Link copied" : "Share list"}
                </button>
                <a
                  href={members.length ? requestUrlFor(requestUrl, active, members, showRates) : requestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                >
                  Request with this list
                </a>
              </div>
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
          <dt className="tile-label mb-0.5">{i.label}</dt>
          <dd className="font-display text-lg font-extrabold leading-tight tabular-nums">
            {i.value}
            {i.note && <span className="ml-1 font-sans text-xs font-normal text-muted">({i.note})</span>}
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
    <div className="max-h-[60vh] overflow-y-auto border-b border-line pt-6 pb-5">
      <div className="mb-5">{totals}</div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="mr-2">
          <span className="field-label">Your lists</span>
          <select value={active.id} onChange={(e) => onSwitch(e.target.value)} className="field w-auto min-w-[220px] font-bold">
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} ({l.creatorIds.length})
              </option>
            ))}
          </select>
        </label>
        <button onClick={onNew} className="btn btn-quiet btn-sm">
          New list
        </button>
        <button onClick={onRename} className="btn btn-quiet btn-sm">
          Rename
        </button>
        <button onClick={onDelete} className="btn btn-quiet btn-sm">
          Delete
        </button>
        <span className="ml-2 self-center text-xs text-muted">Lists are saved in this browser. Use Share list to send one to a colleague.</span>
      </div>
      {members.length === 0 ? (
        <p className="mt-4 text-sm text-muted">This list is empty. Use “Add to list” on any creator.</p>
      ) : (
        <div className="table-wrap mt-4">
          <table>
            <thead>
              <tr>
                <th>Creator</th>
                <th className="num">Followers</th>
                <th className="num">Median views</th>
                {showRates && <th className="num">Rate</th>}
                {showRates && <th className="num">CPM</th>}
                <th />
              </tr>
            </thead>
            <tbody>
              {members.map((c) => (
                <tr key={c.id}>
                  <td className="font-bold">{c.name}</td>
                  <td className="num">{compact(reach(c))}</td>
                  <td className="num">{c.avgViews ? compact(c.avgViews) : "—"}</td>
                  {showRates && <td className="num">{c.rate ? money(c.rate) : "—"}</td>}
                  {showRates && <td className="num">{creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}</td>}
                  <td className="text-right">
                    <button onClick={() => onRemove(c.id)} className="btn btn-quiet btn-sm">
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  return (
    <section className="card mt-3.5" aria-label="Creators">
      <div className="table-wrap">
        <table className="min-w-[860px]">
          <thead>
            <tr>
              <th>Creator</th>
              <th className="num">TikTok</th>
              <th className="num">Instagram</th>
              <th className="num">
                Median views<span className="block font-sans font-normal normal-case tracking-normal">last 10 posts</span>
              </th>
              {showRates && <th className="num">Rate</th>}
              {showRates && (
                <th className="num" title="Rate ÷ median views (last 10 posts) × 1,000">
                  CPM
                </th>
              )}
              <th>Tags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {creators.map((c) => (
              <tr key={c.id} className="align-top">
                <td>
                  <p className="font-bold">{c.name}</p>
                  {c.location && <span className="cell-sub">{c.location}</span>}
                </td>
                <td className="num">
                  {c.tiktok ? (
                    <a href={`https://www.tiktok.com/@${c.tiktok}`} target="_blank" rel="noreferrer" className="hover:text-fb-red">
                      <span className="font-bold">{c.tiktokFollowers ? compact(c.tiktokFollowers) : "—"}</span>
                      <span className="cell-sub">@{c.tiktok}</span>
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num">
                  {c.instagram ? (
                    <a href={`https://www.instagram.com/${c.instagram}/`} target="_blank" rel="noreferrer" className="hover:text-fb-red">
                      <span className="font-bold">{c.instagramFollowers ? compact(c.instagramFollowers) : "—"}</span>
                      <span className="cell-sub">@{c.instagram}</span>
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="num font-bold">{c.avgViews ? compact(c.avgViews) : "—"}</td>
                {showRates && <td className="num">{c.rate ? money(c.rate) : "—"}</td>}
                {showRates && <td className="num">{creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}</td>}
                <td className="whitespace-normal text-xs text-secondary">{c.tags.join(", ")}</td>
                <td className="text-right">
                  <AddButton added={inList(c.id)} onClick={() => onToggle(c.id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddButton({ added, onClick }: { added: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={added} className={`btn btn-sm ${added ? "btn-primary" : ""}`}>
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

  // Brand black in both modes, so the white initials and the B&W photo read the same in light and dark.
  const picture = (
    <div className="group relative aspect-[4/5] overflow-hidden bg-fb-ink">
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
          className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-fb-red text-white shadow-lift transition-transform group-hover:scale-110"
        >
          <svg viewBox="0 0 24 24" className="size-4 fill-current">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      )}
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 bg-fb-red" />
    </div>
  );

  return (
    <article className="card flex h-full flex-col overflow-hidden p-0">
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" aria-label={`${c.name} on ${tiktokFirst ? "TikTok" : "Instagram"}`}>
          {picture}
        </a>
      ) : (
        picture
      )}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-[15px] font-bold leading-tight tracking-[0.02em]">{c.name}</h3>
        {handle && <p className="mt-0.5 text-xs text-muted">@{handle}</p>}
        <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
          <div>
            <dt className="tile-label mb-0.5">Followers</dt>
            <dd className="font-display text-lg font-extrabold leading-tight tabular-nums">{reach(c) ? compact(reach(c)) : "—"}</dd>
          </div>
          <div>
            <dt className="tile-label mb-0.5">Median views</dt>
            <dd className="font-display text-lg font-extrabold leading-tight tabular-nums">{c.avgViews ? compact(c.avgViews) : "—"}</dd>
          </div>
          {showRates && (
            <div>
              <dt className="tile-label mb-0.5">Rate</dt>
              <dd className="font-display text-lg font-extrabold leading-tight tabular-nums">{c.rate ? money(c.rate) : "—"}</dd>
            </div>
          )}
          {showRates && (
            <div title="Rate ÷ median views (last 10 posts) × 1,000">
              <dt className="tile-label mb-0.5">CPM</dt>
              <dd className="font-display text-lg font-extrabold leading-tight tabular-nums">
                {creatorCpm(c) !== undefined ? money(creatorCpm(c)!, 2) : "—"}
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-auto pt-3.5">
          <AddButton added={added} onClick={onToggle} />
        </div>
      </div>
    </article>
  );
}

function FilterSelect({
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
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
