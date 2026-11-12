"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A search box over a server-rendered list: type part of a name or handle and items whose `data-search`
 * text doesn't match are hidden. Works on any list inside it marked with data-search.
 */
export function RosterSearch({ count, children }: { count: number; children: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(count);

  useEffect(() => {
    const words = query.toLowerCase().replace(/@/g, "").split(/\s+/).filter(Boolean);
    let n = 0;
    box.current?.querySelectorAll<HTMLElement>("[data-search]").forEach((el) => {
      const match = words.every((w) => (el.dataset.search ?? "").includes(w));
      el.hidden = !match;
      if (match) n++;
    });
    setShown(n);
  }, [query, count]);

  return (
    <div ref={box}>
      {count > 1 && (
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a creator by name or handle"
            aria-label="Find a creator on this campaign"
            className="field max-w-sm"
          />
          {query && (
            <span role="status" className="text-xs text-muted">
              {shown} of {count}
            </span>
          )}
        </div>
      )}
      {children}
      {query && shown === 0 && <p className="empty mt-3.5">No one on this campaign matches “{query}”.</p>}
    </div>
  );
}
