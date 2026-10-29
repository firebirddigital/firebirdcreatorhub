export function compact(n: number): string {
  if (!isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: n >= 1000 && n < 10_000_000 ? 1 : 0,
  }).format(n);
}

export function full(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function pct(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function money(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dateRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && !end) return `From ${shortDate(start)}`;
  if (!start && end) return `Until ${shortDate(end)}`;
  return `${shortDate(start)} – ${shortDate(end)}`;
}

export function timeAgo(iso?: string): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** How actual views compare with expected, e.g. "2.4×" or "12×". */
export function times(views: number, expected: number): string | undefined {
  if (!expected) return undefined;
  const r = views / expected;
  if (r < 0.1) return "<0.1×";
  return `${r >= 10 ? Math.round(r) : r.toFixed(1)}×`;
}

/**
 * The typical post's views against its creator's usual average: the middle of the per-post ratios.
 * One creator with an inflated average can't drag the whole campaign's figure down.
 */
export function typicalVsUsual(posts: { views: number; creator?: { avgViews?: number } }[]): string | undefined {
  const ratios = posts
    .filter((p) => p.creator?.avgViews)
    .map((p) => p.views / p.creator!.avgViews!)
    .sort((a, b) => a - b);
  if (!ratios.length) return undefined;
  const mid = Math.floor(ratios.length / 2);
  const median = ratios.length % 2 ? ratios[mid] : (ratios[mid - 1] + ratios[mid]) / 2;
  return times(median, 1);
}

/**
 * Expected cost per 1,000 views: total cost per post ÷ total average views per post × 1,000, using only
 * creators with both. Weighted, so a big, expensive creator counts in proportion.
 */
export function expectedCpm(items: { cost?: number; avgViews?: number }[]): { cpm?: number; counted: number; total: number } {
  const both = items.filter((i) => i.cost && i.avgViews);
  const views = both.reduce((t, i) => t + i.avgViews!, 0);
  const cost = both.reduce((t, i) => t + i.cost!, 0);
  return { cpm: views ? (cost / views) * 1000 : undefined, counted: both.length, total: items.length };
}

/**
 * Current CPM against expected: how far under (cheaper, better) or over (dearer) it is.
 * Returns undefined unless both are known.
 */
export function cpmVsExpected(current?: number, expected?: number): { under: boolean; text: string } | undefined {
  if (current === undefined || expected === undefined || !expected) return undefined;
  const diff = (current - expected) / expected;
  if (Math.abs(diff) < 0.005) return { under: true, text: "On expected" };
  return { under: diff < 0, text: `${Math.round(Math.abs(diff) * 100)}% ${diff < 0 ? "under" : "over"} expected` };
}

/** A creator's cost per 1,000 views: rate ÷ median views (last 10 posts) × 1,000. Needs both. */
export function creatorCpm(c: { rate?: number; avgViews?: number }): number | undefined {
  return c.rate && c.avgViews ? (c.rate / c.avgViews) * 1000 : undefined;
}

/** "CPM up to" filter choices, shared by the creators page and the shareable link with rates. */
export const CPM_OPTIONS = [0, 5, 10, 20, 50, 100];

/** The middle value, rounded (the mean of the middle two for an even count), so one viral post doesn't skew it. */
export function median(xs: number[]): number | undefined {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}
