import type { ReactNode } from 'react'

export interface TooltipRow { label: string; value: string; color?: string }

/**
 * Values lead, labels follow - the reader already knows the series and wants the
 * number. Series names go in via children/textContent, never innerHTML.
 */
export function Tooltip({ x, y, title, rows, containerWidth, note }: {
  x: number; y: number; title: string; rows: TooltipRow[]; containerWidth: number
  /** One line under the rows — a caveat, or what to make of an empty list. */
  note?: string
}) {
  /*
   * A marker's tooltip carries sentences, not just a number per series, and 190px
   * broke "227K vs 6.9K typical" across two lines. The note is the signal that
   * this is that kind of tooltip.
   */
  const width = note ? 260 : 190
  const flip = x + width + 20 > containerWidth
  const style = { left: flip ? x - width - 14 : x + 14, top: Math.max(y - 12, 4), width }

  return (
    <div className="tooltip" style={style} role="status">
      <div className="tooltip-title">{title}</div>
      {rows.map((r, i) => (
        <div className="tooltip-row" key={`${r.label}-${i}`}>
          {r.color ? <span className="k" style={{ background: r.color }} /> : null}
          <span className="n">{r.label}</span>
          <span className="v">{r.value}</span>
        </div>
      ))}
      {note ? <div className="tooltip-note">{note}</div> : null}
    </div>
  )
}

export function Legend({ items, kind = 'line' }: {
  items: Array<{ label: string; color: string }>; kind?: 'line' | 'swatch'
}) {
  // One series needs no legend - the title already names what is plotted.
  if (items.length < 2) return null
  return (
    <div className="legend">
      {items.map((i) => (
        <span className="legend-item" key={i.label}>
          <span className={kind === 'line' ? 'legend-line' : 'legend-swatch'} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  )
}

export function Card({ title, caption, action, children }: {
  title: string; caption?: string; action?: ReactNode; children: ReactNode
}) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {caption ? <p className="caption">{caption}</p> : <div style={{ height: 12 }} />}
        </div>
        <div className="spacer" />
        {action}
      </div>
      {children}
    </section>
  )
}
