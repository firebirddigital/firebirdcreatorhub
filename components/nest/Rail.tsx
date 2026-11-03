"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

/**
 * The Nest kit's frame for team pages: a black rail down the left with the sections on it,
 * and the page beside it. Below 900px the rail lies down as a strip across the top (nest.css).
 * The rail remembers whether it's open; storage is never allowed to break the page.
 */
export type Section = "campaigns" | "creators" | "analytics";

const SECTIONS: { key: Section; label: string; href: string }[] = [
  { key: "campaigns", label: "Campaigns", href: "/campaigns" },
  { key: "creators", label: "Creators", href: "/creators" },
  { key: "analytics", label: "Analytics", href: "/analytics" },
];

export function Rail({
  active,
  counts,
  signOut,
  children,
}: {
  active?: Section;
  counts?: Partial<Record<Section, number>>;
  signOut: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem("rail") !== "closed");
    } catch {}
  }, []);
  const toggle = () => {
    setOpen((v) => {
      try {
        localStorage.setItem("rail", v ? "closed" : "open");
      } catch {}
      return !v;
    });
  };

  return (
    <div className="shell" data-rail={open ? "open" : "closed"}>
      <aside className="sidenav">
        {/* Brand rule: the logo anchors the top-left with clear space around it. */}
        <div className="sidenav-brand">
          <Link href="/campaigns" aria-label="Firebird Creator Hub home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/firebird-logotype-white.png" alt="Firebird" className="brand-logo" />
          </Link>
          <span className="nav-label" style={{ margin: 0, padding: 0 }}>
            Creator Hub
          </span>
        </div>

        <button className="rail-toggle" onClick={toggle} aria-expanded={open} title={open ? "Collapse the menu" : "Expand the menu"}>
          <span aria-hidden="true">{open ? "«" : "»"}</span>
          <span className="rail-toggle-say">{open ? "Collapse menu" : "Expand menu"}</span>
        </button>

        <nav className="sidenav-nav" aria-label="Sections">
          {SECTIONS.map((s) => (
            <Link key={s.key} href={s.href} className="nav-item" aria-current={active === s.key ? "page" : undefined}>
              {s.label}
              {counts?.[s.key] ? <span className="nav-count">{counts[s.key]}</span> : null}
            </Link>
          ))}
        </nav>

        <div className="sidenav-foot">
          <ThemeSwitch />
          {signOut && (
            <form action="/api/logout" method="post" className="nav-account" style={{ padding: "12px 4px 0" }}>
              <button className="nav-account-out">Sign out</button>
            </form>
          )}
        </div>
      </aside>

      <main className="app">{children}</main>
    </div>
  );
}

type Theme = "auto" | "light" | "dark";

/** Auto follows the computer's setting; Light and Dark pin it. Applied before paint by the script in the layout. */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>("auto");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {}
  }, []);
  const choose = (t: Theme) => {
    setTheme(t);
    try {
      if (t === "auto") localStorage.removeItem("theme");
      else localStorage.setItem("theme", t);
    } catch {}
    if (t === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  };
  return (
    <div className="seg" role="group" aria-label="Colour scheme">
      {(["auto", "light", "dark"] as const).map((t) => (
        <button key={t} type="button" aria-pressed={theme === t} onClick={() => choose(t)}>
          {t === "auto" ? "Auto" : t === "light" ? "Light" : "Dark"}
        </button>
      ))}
    </div>
  );
}

/** The page heading row, with optional actions on the right. */
export function PageHead({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head flex flex-wrap items-center gap-3">
      <h1>{title}</h1>
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

/** A segmented control that changes the page address, for filters that live in the URL. */
export function SegLinks({ label, options }: { label: string; options: { href: string; label: ReactNode; active: boolean; count?: number }[] }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <Link key={o.href} href={o.href} aria-pressed={o.active} className="seg-link">
          {o.label}
          {o.count != null ? <span className="tab-count">{o.count}</span> : null}
        </Link>
      ))}
    </div>
  );
}
