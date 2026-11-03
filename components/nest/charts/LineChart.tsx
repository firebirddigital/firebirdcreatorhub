"use client";

import { useState, useMemo } from 'react'
import { useMeasure } from './useMeasure'
import { Tooltip, Legend, type TooltipRow } from '../Tooltip'
import { axisLabels, compact, shortDate, niceTicks, niceTicksBetween, niceTicksSigned } from '../format'

export interface Series { key: string; label: string; color: string; points: Array<{ date: string; value: number | null }> }

/**
 * Longest stretch, in days, a dashed bridge will span.
 *
 * Chartmetric polls weekly for most artists and daily for the big ones, so a
 * fortnight of silence is cadence rather than absence. A month is the outer
 * edge of that; past it the line would be inventing a trend across a hole
 * nobody measured, so the hole stays a hole.
 */
export const BRIDGE_MAX_DAYS = 31

const daysApart = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export interface SeriesShape {
  /** Runs of adjacent known points, as indexes into `dates`. Each has >=1 entry. */
  runs: number[][]
  /** [from, to] index pairs to draw a dashed bridge between. */
  bridges: Array<[number, number]>
}

/**
 * Work out what to draw for one series: where it was measured, and which of the
 * holes between those stretches are short enough to bridge.
 *
 * The x-axis is the union of every series' dates, so a series polled weekly
 * breaks into single points against one polled daily — which is why a
 * benchmark against four other artists used to come back as confetti. A bridge
 * is drawn dashed rather than solid: the reader still sees that nothing was
 * measured there, but gets the shape of the line back.
 *
 * `bridgeMaxDays` of 0 disables bridging entirely, which is the default for
 * first-party counts where a hole is the honest answer.
 */
export function shapeSeries(
  dates: string[],
  known: (i: number) => boolean,
  bridgeMaxDays: number,
): SeriesShape {
  const runs: number[][] = []
  let current: number[] = []
  for (let i = 0; i < dates.length; i += 1) {
    if (known(i)) { current.push(i); continue }
    if (current.length > 0) { runs.push(current); current = [] }
  }
  if (current.length > 0) runs.push(current)

  const bridges: Array<[number, number]> = []
  if (bridgeMaxDays > 0) {
    for (let r = 1; r < runs.length; r += 1) {
      const from = runs[r - 1]!.at(-1)!
      const to = runs[r]![0]!
      if (daysApart(dates[from]!, dates[to]!) <= bridgeMaxDays) bridges.push([from, to])
    }
  }
  return { runs, bridges }
}

/**
 * A marked day, with what to say about it on hover.
 *
 * The chart already shows that a day was unusual — the line does that by being a
 * spike. What it cannot show is why, so the marker carries that and nothing else.
 */
export interface Annotation {
  date: string
  title: string
  rows: TooltipRow[]
  /** One line under the rows, for a caveat or a nothing-found note. */
  note?: string
}

const PAD = { top: 14, right: 62, bottom: 26, left: 46 }
/** Headroom for the marker glyph, added only when there is one to draw. */
const MARKER_BAND = 20

/**
 * Multi-series line chart. 2px strokes, >=8px end markers with a 2px surface ring,
 * hairline gridlines, one crosshair tooltip listing every series at the hovered X.
 * Never a second y-axis - callers index to a common base or use two charts.
 */
export function LineChart({
  series, height = 240, valueFormat = compact, showEndLabels = true, annotations = [],
  zeroBased = true, reference = null, bridgeGaps = false,
}: {
  series: Series[]; height?: number; valueFormat?: (n: number | null) => string
  showEndLabels?: boolean
  annotations?: Annotation[]
  /**
   * Join short gaps with a dashed line instead of leaving blank space.
   *
   * On for anything polled from an outside service — Chartmetric reports when
   * it reports, and a line that shatters into dots every time an artist's
   * cadence differs from a peer's reads as a broken chart rather than as
   * missing days. Off by default: for a count we own, a hole means we have no
   * reading and that is worth seeing.
   *
   * `true` uses BRIDGE_MAX_DAYS; a number caps the span in days itself.
   */
  bridgeGaps?: boolean | number
  /**
   * Keep zero in view. True for anything whose size is the point — a zero-cut
   * axis exaggerates a small change into a cliff, and most charts here are
   * counts where that would mislead.
   *
   * False only where the comparison IS the point and every line starts from the
   * same place: an indexed benchmark spends its life between 95 and 165, and
   * anchoring that to zero spends four fifths of the plot on empty space and
   * flattens the differences nobody can then see.
   */
  zeroBased?: boolean
  /** A horizontal rule with a label, for a baseline the reader measures against. */
  reference?: { value: number; label: string } | null
}) {
  const { ref, width } = useMeasure<HTMLDivElement>(640)
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null)
  // A marker's own tooltip wins over the crosshair: pointing at it is a question
  // about that day, not about where the lines are.
  const [marked, setMarked] = useState<{ a: Annotation; x: number; y: number } | null>(null)

  const dates = useMemo(() => {
    const all = new Set<string>()
    for (const s of series) for (const p of s.points) all.add(p.date)
    return [...all].sort()
  }, [series])

  /*
   * The domain has to admit negatives: a change series spends half its life below
   * zero, and a scale anchored at zero drew those points outside the plot box.
   */
  const { min, max } = useMemo(() => {
    let lo = zeroBased ? 0 : Number.POSITIVE_INFINITY
    let hi = zeroBased ? 0 : Number.NEGATIVE_INFINITY
    for (const s of series) {
      for (const p of s.points) {
        if (p.value == null) continue
        if (p.value > hi) hi = p.value
        if (p.value < lo) lo = p.value
      }
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 0 }
    if (reference) { lo = Math.min(lo, reference.value); hi = Math.max(hi, reference.value) }
    if (zeroBased) return { min: lo, max: hi }
    /*
     * A tenth of the range as breathing room, so the top line is not welded to
     * the frame. A flat series has no range to take a tenth of, so it gets an
     * absolute pad instead of collapsing to a zero-height band.
     */
    const pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1
    return { min: lo - pad, max: hi + pad }
  }, [series, zeroBased, reference?.value])

  if (dates.length === 0 || (max === 0 && min === 0)) {
    return <div className="empty">No data in this range.</div>
  }

  const band = annotations.length > 0 ? MARKER_BAND : 0
  const top = PAD.top + band
  const innerW = Math.max(width - PAD.left - PAD.right, 10)
  const innerH = height - top - PAD.bottom
  /*
   * A cut axis picks its own round numbers across the span it actually uses;
   * niceTicks always starts at zero, which is the thing being avoided here.
   */
  const allTicks = !zeroBased ? niceTicksBetween(min, max)
    : min < 0 ? niceTicksSigned(min, max) : niceTicks(max)
  /*
   * A zero-based axis takes its bounds FROM the ticks, so the top of the plot
   * is a round number. A cut axis does the opposite: the bounds are the data
   * plus its padding, and the ticks are only the round numbers that fall
   * inside. Rounding the bounds outward there would reintroduce the dead space
   * the cut was made to remove — an 80 gridline under a series that never goes
   * below 95.
   */
  const yMax = zeroBased ? (allTicks.at(-1) ?? max) : max
  const yMin = zeroBased ? (allTicks[0] ?? 0) : min
  const ticks = zeroBased ? allTicks : allTicks.filter((t) => t >= yMin && t <= yMax)
  const span = yMax - yMin || 1

  /*
   * Tick labels, at the least precision that keeps them distinct.
   *
   * compact() defaults to no decimals here, which is right for a zero-based
   * axis running 0..5M. On a CUT axis the ticks can sit close enough that two
   * of them round to the same string — a Luminate chart between 850K and 1.05M
   * printed "1M" twice, which reads as a rendering bug. So the precision is
   * raised until every label on the axis is its own number.
   */
  const tickLabels = axisLabels(ticks)

  const xAt = (i: number) => PAD.left + (dates.length === 1 ? innerW / 2 : (i / (dates.length - 1)) * innerW)
  const yAt = (v: number) => top + innerH - ((v - yMin) / span) * innerH

  const byDate = series.map((s) => ({ s, map: new Map(s.points.map((p) => [p.date, p.value])) }))

  const bridgeDays = bridgeGaps === true ? BRIDGE_MAX_DAYS : bridgeGaps === false ? 0 : bridgeGaps
  const shaped = byDate.map(({ s, map }) => ({
    s, map, ...shapeSeries(dates, (i) => map.get(dates[i]!) != null, bridgeDays),
  }))

  // Endpoint of each series, and which of those endpoints can carry a direct label.
  const ends = byDate.map(({ s, map }) => {
    const i = dates.reduce((acc, d, idx) => (map.get(d) != null ? idx : acc), -1)
    return i < 0 ? null : { key: s.key, color: s.color, i, value: map.get(dates[i]!)! }
  }).filter((e): e is NonNullable<typeof e> => e !== null)

  // When lines converge at the right edge, nudging labels apart detaches them from
  // their lines and reads as noise - so drop the colliders and let the legend and
  // tooltip carry those series instead.
  const labelled = new Set<string>()
  if (showEndLabels && series.length <= 4) {
    const taken: number[] = []
    for (const e of [...ends].sort((a, b) => b.value - a.value)) {
      const y = yAt(e.value)
      if (taken.every((t) => Math.abs(t - y) >= 13)) { labelled.add(e.key); taken.push(y) }
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const rel = e.clientX - rect.left
    const ratio = (rel - PAD.left) / innerW
    const i = Math.max(0, Math.min(dates.length - 1, Math.round(ratio * (dates.length - 1))))
    setHover({ i, x: xAt(i), y: e.clientY - rect.top })
  }

  /*
   * Only days the chart actually plots can be marked, and each marker's hit area
   * is clipped to the gap before its neighbour — two spikes a couple of days
   * apart otherwise overlap, and the pointer lands on whichever drew last rather
   * than the one aimed at.
   */
  const marks = (() => {
    const found = annotations
      .flatMap((a) => { const i = dates.indexOf(a.date); return i < 0 ? [] : [{ a, i, x: xAt(i) }] })
      .sort((p, q) => p.x - q.x)
    return found.map((m, idx) => {
      const left = idx > 0 ? m.x - found[idx - 1]!.x : Infinity
      const right = idx < found.length - 1 ? found[idx + 1]!.x - m.x : Infinity
      const half = Math.max(5, Math.min(13, Math.min(left, right) / 2))
      return { ...m, half }
    })
  })()

  const hoveredDate = hover ? dates[hover.i]! : null

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <Legend items={series.map((s) => ({ label: s.label, color: s.color }))} />
      <svg
        width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Line chart: ${series.map((s) => s.label).join(', ')}`}
        onPointerMove={onMove}
        onPointerLeave={() => { setHover(null); setMarked(null) }}
        style={{ touchAction: 'none' }}
      >
        {ticks.map((t, i) => (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={yAt(t) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {tickLabels[i]}
            </text>
          </g>
        ))}

        {[0, Math.floor(dates.length / 2), dates.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
          <text key={i} x={xAt(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
            fontSize={10} fill="var(--text-muted)">{shortDate(dates[i]!)}</text>
        ))}

        {/* Zero is the reference a change series is read against, so it is drawn
            darker than a gridline rather than left to blend in. */}
        {yMin < 0 ? (
          <line x1={PAD.left} x2={width - PAD.right} y1={yAt(0)} y2={yAt(0)}
            stroke="var(--axis)" strokeWidth={1} />
        ) : null}

        {/* The line the reader measures against. Dashed, so it is plainly not a
            series, and labelled, because an unlabelled rule is a mystery. */}
        {reference && reference.value >= yMin && reference.value <= yMax ? (
          <g>
            <line x1={PAD.left} x2={width - PAD.right} y1={yAt(reference.value)} y2={yAt(reference.value)}
              stroke="var(--axis)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={width - PAD.right} y={yAt(reference.value) - 5} textAnchor="end"
              fontSize={10} fill="var(--text-muted)">{reference.label}</text>
          </g>
        ) : null}

        {hoveredDate && !marked
          ? <line x1={xAt(hover!.i)} x2={xAt(hover!.i)} y1={top} y2={top + innerH} stroke="var(--axis)" strokeWidth={1} />
          : null}

        {/* A hairline down to the day the marker belongs to, so the glyph is
            attached to a point on the line rather than floating above it. */}
        {marks.map(({ a, i }) => (
          <line key={`rule-${a.date}`} x1={xAt(i)} x2={xAt(i)} y1={top - 4} y2={top + innerH}
            stroke="var(--axis)" strokeWidth={1} strokeDasharray="2 3"
            opacity={marked?.a.date === a.date ? 0.9 : 0.35} />
        ))}

        {shaped.map(({ s, map, runs, bridges }) => {
          const at = (i: number) => `${xAt(i)},${yAt(map.get(dates[i]!)!)}`
          // Measured stretches are solid; a bridged hole is dashed and dimmed, so
          // it never passes for a reading. A gap too long to bridge stays blank.
          const segments = runs.map((run) => run.map((i, n) => `${n ? 'L' : 'M'}${at(i)}`).join(''))
          /*
           * A lone reading between two gaps is a path with one point, which draws
           * nothing at all — a dot is the only way it appears. Dotting them also
           * says which vertices on a mostly-dashed line were actually measured.
           */
          const lone = runs.filter((run) => run.length === 1).map((run) => run[0]!)

          const end = ends.find((e) => e.key === s.key)

          return (
            <g key={s.key}>
              {bridges.map(([a, b]) => (
                <path key={`bridge-${a}-${b}`} d={`M${at(a)}L${at(b)}`} fill="none" stroke={s.color}
                  strokeWidth={2} strokeDasharray="4 5" strokeLinecap="round" opacity={0.6} />
              ))}
              {segments.map((d, i) => (
                <path key={i} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              ))}
              {lone.map((i) => (
                <circle key={`lone-${i}`} cx={xAt(i)} cy={yAt(map.get(dates[i]!)!)} r={2.5} fill={s.color} />
              ))}
              {end ? (
                <>
                  <circle cx={xAt(end.i)} cy={yAt(end.value)} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
                  {labelled.has(s.key) ? (
                    <text x={xAt(end.i) + 9} y={yAt(end.value) + 4} fontSize={11} fontWeight={600} fill="var(--text-secondary)">
                      {valueFormat(end.value)}
                    </text>
                  ) : null}
                </>
              ) : null}
            </g>
          )
        })}

        {hoveredDate
          ? byDate.map(({ s, map }) => {
              const v = map.get(hoveredDate)
              return v == null ? null : (
                <circle key={s.key} cx={xAt(hover!.i)} cy={yAt(v)} r={4} fill={s.color} stroke="var(--surface-1)" strokeWidth={2} />
              )
            })
          : null}
        {/* Drawn last so the markers sit over the lines, with a hit area far
            bigger than the glyph. */}
        {marks.map(({ a, i, half }) => (
          <g key={`mark-${a.date}`}
            onPointerEnter={(e) => {
              const rect = ref.current?.getBoundingClientRect()
              if (rect) setMarked({ a, x: xAt(i), y: e.clientY - rect.top })
            }}
            onPointerLeave={() => setMarked(null)}
            style={{ cursor: 'help' }}
          >
            <title>{a.title}</title>
            <rect x={xAt(i) - half} y={top - band - 2} width={half * 2} height={band + 10} fill="transparent" />
            <text x={xAt(i)} y={top - 6} textAnchor="middle" fontSize={14}
              opacity={marked?.a.date === a.date ? 1 : 0.75}
              style={{ filter: marked?.a.date === a.date ? 'none' : 'grayscale(0.4)' }}
            >💡</text>
          </g>
        ))}
      </svg>

      {marked ? (
        <Tooltip
          x={marked.x} y={marked.y} containerWidth={width}
          title={marked.a.title} rows={marked.a.rows} note={marked.a.note}
        />
      ) : hoveredDate ? (
        <Tooltip
          x={hover!.x} y={hover!.y} containerWidth={width}
          title={new Date(`${hoveredDate}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
          rows={byDate.map(({ s, map }) => ({ label: s.label, value: valueFormat(map.get(hoveredDate) ?? null), color: s.color }))}
          /* A dash in a row next to a line that is plainly drawn here needs
             explaining, or it reads as a bug rather than as a day nobody
             reported. Only said when the crosshair is actually inside a bridge. */
          note={shaped.some(({ bridges }) => bridges.some(([a, b]) => hover!.i > a && hover!.i < b))
            ? 'Dashed: no reading on this day. The line is drawn between the readings either side.'
            : undefined}
        />
      ) : null}
    </div>
  )
}
