# Restyling the Creator Hub with the Nest UI kit

The hub is moving from its old look (sharp 2px black borders, black hero blocks, huge type, top nav)
to the Nest UI kit: black side rail, a faint grey page, white rounded cards with soft shadows,
small red ALL-CAPS headings, stat tiles, pill-shaped segmented filters, and light + dark mode.

**Restyle only. Do not change behaviour, data, props, exports, API calls, copy, or logic.**
Keep every button, field, link, message and state that exists today. If a component's markup must
be restructured to fit a card, keep its exported name and props identical.

## Where things are
- `app/nest.css`: the kit's stylesheet (in Tailwind's components layer, so utilities still win). Read the
  class list there before inventing anything. The "Creator Hub additions" block at the bottom adds
  `.btn`, `.field`, `dialog.sheet`, link versions of `.seg` and `.tabs`, and `.public-page`.
- `app/globals.css`: Tailwind colour tokens that point at the kit's variables.
- `components/nest/Rail.tsx`: `Rail`, `PageHead`, `SegLinks`, `ThemeSwitch`.
- `components/Header.tsx`: `TeamShell` (replaces the old `Header` + `<main className="px-[57px]...">`).
- `components/nest/`: kit components: `Tooltip.tsx` (`Card`, `Legend`, `Tooltip`), `StatTile.tsx`,
  `charts/LineChart.tsx`, `charts/BarChart.tsx`, `charts/Sparkline.tsx`, `ExportButton.tsx`, `format.ts`.
- **Reference example, already done:** `app/campaigns/page.tsx`, `components/CampaignFilters.tsx`,
  `components/StatusTag.tsx`. Match their style.

## Colours (Tailwind classes)
| Class | Means |
|---|---|
| `text-fb-red`, `bg-fb-red`, `border-fb-red` | Firebird red (#ED2124) |
| `text-fb-black` / `bg-fb-black` | **ink**: black in light mode, WHITE in dark mode |
| `bg-fb-white` / `text-fb-white` | **surface**: white in light mode, near-black in dark mode |
| `bg-fb-ink` | always brand black (use for things that must stay black, e.g. a photo overlay) |
| `text-white`, `bg-white` | literal white (use for text on red or on `bg-fb-ink`) |
| `bg-page`, `bg-surface` | page background / card background |
| `text-secondary`, `text-muted` | secondary and muted text |
| `border-line` (soft), `border-line-strong` | borders |
| `bg-wash` (red tint), `bg-wash-neutral` (grey tint) | hover and selected fills |
| `rounded-card` (12px), `rounded-control` (9px), `shadow-tile`, `shadow-lift` | shape |

Because `fb-black`/`fb-white` flip in dark mode, **never build a "black block with white text"
using `bg-fb-black text-fb-white`**: in dark mode it becomes a white block. Use a `.card` instead,
or `bg-fb-ink text-white` if it truly must be black in both modes. `text-fb-black/60` style opacity
shades are fine but prefer `text-muted` / `text-secondary`. Avoid Tailwind greys/greens/blues
(`text-gray-*`, `text-green-700`, `bg-zinc-*`); for a "good" signal on team pages use
`text-[color:var(--series-4)]`. Anything you colour must read in BOTH light and dark mode.

**Brand rule:** red, black and white only. Partner, creator and artist pages (`app/share`, `app/artist`,
`app/roster`, `app/submit`, `components/RosterShowcase.tsx`, `components/WrapReport.tsx`, and any
component with an `internal`/partner flag when rendered for partners) must use only red/black/white
and the neutral tokens. Team-only pages may use `var(--series-2..5)` for multi-line charts.
Photography stays black and white (`.bw` class or `filter grayscale`).

## Patterns: old → new
- **Page frame (team pages):** `<Header active="x" /><main className="px-[57px] ...">…</main>` →
  `<TeamShell active="x">…</TeamShell>`, with `<PageHead title="Creators">{actions}</PageHead>` first.
- **Page heading:** giant `headline text-7xl` → `PageHead` (team) or `<h1 className="headline text-3xl">`
  (public pages: keep it confident but no larger than `text-4xl`/`text-5xl` for a campaign name hero).
- **Section heading:** `subtitle text-2xl` etc. above a block → `<h2 className="section-title">Title</h2>`.
- **Boxes:** `border-2 border-fb-black p-6` → `className="card"` (add `hero` for the one lead number).
  Card title: `<h2>` inside `.card` is styled automatically (12px caps); add `<p className="caption">`
  for the explainer line. `components/nest/Tooltip.tsx` exports `Card({title, caption, action})`.
- **Grids of cards:** `grid gap-...` → `className="grid cards"` (4→2→1), `grid cards-3`, `grid two-col`,
  or Tailwind grid with `gap-3.5`.
- **Big numbers:** `figure text-6xl text-fb-red` → `.tile-label` (label above) + `.tile-value`
  (29px; inside `.card.hero` it becomes 44px red). Don't exceed ~44px for any number on team pages.
  On public pages the single lead number may be larger (up to ~72px).
- **Buttons:** `className="btn"`; main action `btn btn-primary`; text-ish action `btn btn-quiet`;
  small `btn-sm`. Underlined text links can stay as links: `underline underline-offset-4 hover:text-fb-red`.
- **Inputs/selects/textarea:** `className="field"`, label text `<span className="field-label">`.
  Inside a filter strip use the `.filter-row` pattern (see CampaignFilters).
- **Tabs / toggles:** buttons with `aria-pressed` inside `<div className="seg">`, or `SegLinks` for
  URL-driven ones; underline tabs: `<nav className="tabs">` with `<a aria-current="page">` or
  `<button aria-selected>`.
- **Status/tags:** `<span className="pill">` (red fill for the "live/now" state, like StatusTag).
- **Notices:** `<div className="banner">` (red left rule). Errors: `text-fb-red text-sm font-bold`.
- **Empty states:** `<p className="empty">…</p>` inside the card.
- **Tables:** wrap in `<div className="table-wrap">`; use `th`, `td`, `td.num` for numbers.
- **Popups:** `<dialog>` → add `className="sheet ..."` (rounded raised card + dim backdrop).
- **Separators:** `border-b-2 border-fb-black` → `border-b border-line`.
- **Type:** body is 14px Lato; small text `text-xs text-muted`. Keep `.subtitle` for small caps labels
  only (e.g. `subtitle text-[11px] text-muted`). Remove `max-w-prose` only if it breaks a card.
- **Spacing:** cards stack with `mt-3.5`/`gap-3.5`; between major sections use `.section-title`
  (it has its own top margin). No 57px page padding anywhere (the shell supplies padding).

## Rules
- Only edit the files you were assigned. Other agents are editing the rest at the same time.
- Don't touch `app/nest.css`, `app/globals.css`, `components/nest/*`, `components/Header.tsx`.
  If you need a style that doesn't exist, use Tailwind utilities with the tokens above in your file.
- Don't run git, don't install packages, don't start servers or use the browser.
- When done, run `npx tsc --noEmit 2>&1 | grep -v "^firebird-creator-hub/"` from the project root and
  fix any errors in your files (errors in other agents' files may appear while they work; ignore those).
- Report: files changed, anything you couldn't restyle cleanly, and any behaviour you were unsure about.
