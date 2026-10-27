"use client";

import { useMemo, useState } from "react";
import { compact } from "@/lib/format";
import type { Creator } from "@/lib/types";

const UNTAGGED = "More creators";

/**
 * The shareable creators page for partners: black, one row of creator tiles per tag, a search bar and
 * tag pills. Tapping a creator opens their main profile. Data arrives already stripped of anything private.
 */
export function RosterShowcase({ creators, requestUrl }: { creators: Creator[]; requestUrl: string }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string>();

  // Tags by how many creators have them, so the biggest groups come first.
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    creators.forEach((c) => c.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
  }, [creators]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    if (!q) return creators;
    return creators.filter((c) =>
      [c.name, c.instagram, c.tiktok, c.location, ...c.tags].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [creators, query]);

  const reach = (c: Creator) => c.instagramFollowers + c.tiktokFollowers;
  const byReach = (list: Creator[]) => [...list].sort((a, b) => reach(b) - reach(a));

  const sections = useMemo(() => {
    const groups = (tag ? [tag] : tags).map((t) => ({ title: t, creators: byReach(matches.filter((c) => c.tags.includes(t))) }));
    if (!tag) {
      const untagged = matches.filter((c) => !c.tags.length);
      if (untagged.length) groups.push({ title: UNTAGGED, creators: byReach(untagged) });
    }
    return groups.filter((g) => g.creators.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, tags, tag]);

  return (
    <div className="bg-fb-black text-fb-white">
      <div className="px-[57px] max-sm:px-6">
        <section className="mt-10 flex flex-wrap items-center justify-between gap-6 border-2 border-fb-red p-8 max-sm:p-5">
          <div>
            <h2 className="headline text-4xl max-sm:text-3xl">Want creators like these?</h2>
            <p className="mt-2">Pick the creators you like, then send us a request. We&apos;ll take it from there.</p>
          </div>
          <a
            href={requestUrl}
            target="_blank"
            rel="noreferrer"
            className="subtitle bg-fb-red px-7 py-4 text-sm text-fb-white hover:bg-fb-white hover:text-fb-black transition-colors"
          >
            Request a campaign
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
          <div role="group" aria-label="Filter by tag" className="mt-4 flex flex-wrap gap-2 pb-4">
            {[undefined, ...tags].map((t) => {
              const on = tag === t;
              return (
                <button
                  key={t ?? "all"}
                  onClick={() => setTag(t)}
                  aria-pressed={on}
                  className={`subtitle px-4 py-2 text-xs border-2 transition-colors ${
                    on ? "bg-fb-red border-fb-red text-fb-white" : "border-fb-white text-fb-white hover:bg-fb-white hover:text-fb-black"
                  }`}
                >
                  {t ?? "All"}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t-2 border-fb-red pb-24">
        {sections.length === 0 ? (
          <p className="px-[57px] max-sm:px-6 pt-10">No creators match that search.</p>
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
                  tag ? "grid gap-6 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]" : "flex gap-6 overflow-x-auto pb-4 snap-x"
                }`}
              >
                {s.creators.map((c) => (
                  <li key={c.id} className={tag ? "" : "w-[220px] shrink-0 snap-start"}>
                    <CreatorTile creator={c} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function CreatorTile({ creator: c }: { creator: Creator }) {
  // Tap opens their bigger platform, so partners see the creator's actual content.
  const tiktokFirst = c.tiktok && (!c.instagram || c.tiktokFollowers >= c.instagramFollowers);
  const href = tiktokFirst
    ? `https://www.tiktok.com/@${c.tiktok}`
    : c.instagram
      ? `https://www.instagram.com/${c.instagram}/`
      : undefined;
  const handle = tiktokFirst ? c.tiktok : c.instagram;
  const followers = c.instagramFollowers + c.tiktokFollowers;
  const initials = c.name
    .split(/\s+/)
    .map((w) => w[0])
    .filter((ch) => ch && /[A-Za-z0-9]/.test(ch))
    .slice(0, 2)
    .join("");

  const body = (
    <article className="group">
      <div className={`relative aspect-[4/5] overflow-hidden bg-fb-black ${c.photo ? "" : "border-2 border-fb-white"}`}>
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
      <h3 className="subtitle mt-3 text-base leading-tight">{c.name}</h3>
      {handle && <p className="text-sm">@{handle}</p>}
      <dl className="mt-2 flex gap-5 text-sm">
        <div>
          <dt className="text-xs">Followers</dt>
          <dd className="figure text-lg">{followers ? compact(followers) : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs">Avg views</dt>
          <dd className="figure text-lg">{c.avgViews ? compact(c.avgViews) : "—"}</dd>
        </div>
      </dl>
    </article>
  );

  return href ? (
    <a href={href} target="_blank" rel="noreferrer" aria-label={`${c.name} on ${tiktokFirst ? "TikTok" : "Instagram"}`}>
      {body}
    </a>
  ) : (
    body
  );
}
