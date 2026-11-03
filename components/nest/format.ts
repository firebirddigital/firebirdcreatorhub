export function compact(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(digits)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(digits)}M`
  if (abs >= 1e4) return `${(n / 1e3).toFixed(0)}K`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(digits)}K`
  return Math.round(n).toLocaleString('en-US')
}

/**
 * Labels for one axis, at the least precision that keeps them distinct.
 *
 * compact() at no decimals is right for a zero-based axis running 0..5M. On a
 * CUT axis the ticks can sit close enough that two round to the same string — a
 * Luminate chart between 850K and 1.05M printed "1M" twice, which reads as a
 * rendering bug rather than as a tight range.
 *
 * Two escalations, because compact() IGNORES its digits argument under 1000:
 * it rounds to a whole number there, so an axis running 0.5..1.4 collapses to
 * "1" five times over no matter what is asked of it. Those fall through to
 * plain decimals.
 */
export function axisLabels(ticks: number[]): string[] {
  const distinct = (l: string[]) => new Set(l).size === l.length
  for (const digits of [0, 1, 2]) {
    const l = ticks.map((t) => compact(t, digits))
    if (distinct(l)) return l
  }
  for (const digits of [1, 2, 3]) {
    const l = ticks.map((t) => t.toLocaleString('en-US', {
      minimumFractionDigits: digits, maximumFractionDigits: digits,
    }))
    if (distinct(l)) return l
  }
  // Everything collapsed, which means the ticks themselves repeat. Say the
  // numbers plainly rather than inventing precision that is not there.
  return ticks.map((t) => String(t))
}

export const full = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : Math.round(n).toLocaleString('en-US')

export const pct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v == null || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`

export const money = (n: number | null | undefined) =>
  n == null || !Number.isFinite(n) ? '—' : `$${compact(n)}`

/**
 * "Oct 27", or "Jan 23, 2027" once the year stops being obvious.
 *
 * A tour that crosses New Year reads as nonsense without it: "Dec 30" and
 * "Jan 23" sitting in one column look like the same season, when one is eleven
 * months after the other.
 */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear()
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export const NETWORK_LABEL: Record<string, string> = {
  instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook',
  twitter: 'X', threads: 'Threads', linkedin: 'LinkedIn', pinterest: 'Pinterest', bluesky: 'Bluesky',
}

/**
 * Colour follows the entity, never its rank - a network keeps its slot even when
 * filtering removes the networks above it.
 */
const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)']
const NETWORK_ORDER = ['instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'threads', 'linkedin', 'pinterest', 'bluesky']

export function networkColor(network: string): string {
  const i = NETWORK_ORDER.indexOf(network)
  // Past five networks on one chart, identity comes from the legend and table,
  // not from a generated hue.
  return i >= 0 && i < SLOTS.length ? SLOTS[i]! : 'var(--text-muted)'
}

/**
 * Clean axis ticks: 1 / 2 / 5 x 10^n, always running past `max`.
 *
 * The top tick doubles as the scale's upper bound, so it MUST be >= max - stopping
 * short silently clips every point above it out of the plot box.
 */
/**
 * Ticks spanning a domain that may go below zero — a change series does.
 *
 * Both halves get the same step, so the zero line sits on a tick and a drop of 500
 * reads the same length as a rise of 500. Without that the two sides are on
 * different scales and the chart lies about symmetry.
 */
export function niceTicksSigned(min: number, max: number, count = 5): number[] {
  if (min >= 0) return niceTicks(max, count)
  const extent = Math.max(Math.abs(min), Math.abs(max))
  if (!Number.isFinite(extent) || extent <= 0) return [-1, 0, 1]
  const raw = extent / Math.max(Math.floor(count / 2), 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag

  const out: number[] = []
  for (let v = 0; v <= extent + step; v += step) out.push(v)
  const top = out.at(-1)!
  const below: number[] = []
  for (let v = -step; v >= -(Math.abs(min) + step) && v >= -top; v -= step) below.unshift(v)
  return [...below, ...out]
}

export function niceTicks(max: number, count = 5): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const out: number[] = []
  for (let v = 0; out.length < 40; v += step) {
    out.push(v)
    if (v >= max) break
  }
  return out
}

/** Two-letter network marks for the square badge on a post thumbnail. */
export const NET_ABBR: Record<string, string> = {
  instagram: 'IG', tiktok: 'TT', youtube: 'YT', facebook: 'FB',
  twitter: 'X', threads: 'TH', linkedin: 'LI', pinterest: 'PIN', bluesky: 'BS',
}

/**
 * Round tick values across an arbitrary span, without anchoring to zero.
 *
 * niceTicks always starts at zero, which is right for a count and wrong for a
 * cut axis — an indexed comparison living between 95 and 165 needs ticks at
 * 100, 120, 140, 160, not a scale that spends four fifths of itself empty.
 *
 * The returned ends are rounded OUTWARD to the step, so every point stays
 * inside the plot box rather than being clipped by a tighter bound.
 */
export function niceTicksBetween(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1]
  if (max <= min) return [min, min + 1]

  const raw = (max - min) / Math.max(count, 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag

  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step

  const out: number[] = []
  // A tolerance of a thousandth of a step: floating point makes the final
  // addition land a hair over `hi` and drop the top tick.
  for (let v = lo; v <= hi + step / 1000; v += step) {
    out.push(Math.abs(v) < step / 1000 ? 0 : Number(v.toFixed(10)))
  }
  return out.length >= 2 ? out : [lo, hi]
}
