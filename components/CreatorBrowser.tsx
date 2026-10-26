"use client";

import { useMemo, useState } from "react";
import { compact, money } from "@/lib/format";
import type { Creator } from "@/lib/types";

type PlatformFilter = "any" | "instagram" | "tiktok";
type Sort = "reach" | "name" | "rate";

const REACH_OPTIONS = [
  { label: "Any reach", value: 0 },
  { label: "10K+", value: 10_000 },
  { label: "50K+", value: 50_000 },
  { label: "100K+", value: 100_000 },
  { label: "500K+", value: 500_000 },
  { label: "1M+", value: 1_000_000 },
];

const reach = (c: Creator, platform: PlatformFilter) =>
  platform === "instagram"
    ? c.instagramFollowers
    : platform === "tiktok"
      ? c.tiktokFollowers
      : c.instagramFollowers + c.tiktokFollowers;

export function CreatorBrowser({ creators }: { creators: Creator[] }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [platform, setPlatform] = useState<PlatformFilter>("any");
  const [minReach, setMinReach] = useState(0);
  const [sort, setSort] = useState<Sort>("reach");

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [creators]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return creators
      .filter((c) => {
        if (tags.length && !tags.some((t) => c.tags.includes(t))) return false;
        if (platform === "instagram" && !c.instagram) return false;
        if (platform === "tiktok" && !c.tiktok) return false;
        if (reach(c, platform) < minReach) return false;
        if (!q) return true;
        return [c.name, c.instagram, c.tiktok, c.location, ...c.tags]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(q));
      })
      .sort((a, b) =>
        sort === "name"
          ? a.name.localeCompare(b.name)
          : sort === "rate"
            ? (a.rate ?? Infinity) - (b.rate ?? Infinity)
            : reach(b, platform) - reach(a, platform),
      );
  }, [creators, query, tags, platform, minReach, sort]);

  const toggleTag = (t: string) => setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const filtersOn = Boolean(query || tags.length || platform !== "any" || minReach);

  function exportCsv() {
    const rows = [
      ["Name", "Instagram", "Instagram followers", "TikTok", "TikTok followers", "Tags", "Location", "Rate", "Email"],
      ...shown.map((c) => [
        c.name,
        c.instagram ? `@${c.instagram}` : "",
        String(c.instagramFollowers || ""),
        c.tiktok ? `@${c.tiktok}` : "",
        String(c.tiktokFollowers || ""),
        c.tags.join("; "),
        c.location ?? "",
        c.rate ? String(c.rate) : "",
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

  return (
    <div className="mt-12">
      <div className="sticky top-0 z-10 bg-fb-white border-y-2 border-fb-black py-5 space-y-5">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <label className="flex-1 min-w-60">
            <span className="sr-only">Search creators</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, handle or city"
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
            label="Sort"
            value={sort}
            onChange={(v) => setSort(v as Sort)}
            options={[
              { label: "Biggest reach", value: "reach" },
              { label: "Lowest rate", value: "rate" },
              { label: "Name", value: "name" },
            ]}
          />
        </div>

        <div role="group" aria-label="Filter by niche" className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="figure text-2xl">
          {shown.length} <span className="font-sans font-normal text-base tracking-normal">of {creators.length} creators</span>
        </p>
        <div className="flex gap-6 text-sm">
          {filtersOn && (
            <button
              onClick={() => {
                setQuery("");
                setTags([]);
                setPlatform("any");
                setMinReach(0);
              }}
              className="underline underline-offset-4 hover:text-fb-red"
            >
              Clear filters
            </button>
          )}
          <button onClick={exportCsv} disabled={!shown.length} className="font-bold underline underline-offset-4 hover:text-fb-red">
            Download this list
          </button>
        </div>
      </div>

      {shown.length ? (
        <ul className="mt-8 grid gap-x-8 gap-y-12 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
          {shown.map((c) => (
            <li key={c.id}>
              <CreatorCard creator={c} activeTags={tags} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 max-w-prose">No creators match these filters. Remove a niche or lower the follower minimum.</p>
      )}
    </div>
  );
}

function CreatorCard({ creator: c, activeTags }: { creator: Creator; activeTags: string[] }) {
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
      {c.rate && <p className="mt-3 text-sm">Rate {money(c.rate)} per post</p>}
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
