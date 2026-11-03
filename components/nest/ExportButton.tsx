"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { downloadCsv, downloadXlsx, type Dataset } from './export'

/**
 * One export control, in one place, for every tab.
 *
 * The button lives in the filter bar; the tables live in the views. Rather than
 * put a button on each view and hope they end up in the same spot, the active
 * view registers what it can export and the bar renders the control. Switching
 * tabs swaps the contents without the button moving.
 */
interface Registration {
  /** Prefix for the file: artist and range, decided by the shell. */
  prefix: string
  datasets: Dataset[]
}

const ExportContext = createContext<{
  /** Key and label per dataset — enough to draw the menu, and stable. */
  menu: Array<{ key: string; label: string }>
  prefix: string
  /** Read at click time, so the rows are the view's current ones. */
  current: () => Dataset[]
  register: (r: Registration | null) => void
}>({ menu: [], prefix: 'export', current: () => [], register: () => {} })

/**
 * Holds whatever the active view offered.
 *
 * The datasets live in a REF and only their keys live in state. That split is
 * load-bearing: a view's datasets close over its data, so they are rebuilt on
 * every render, and storing them in state meant every render set state, which
 * re-rendered, which rebuilt them again. React caught the loop and gave up,
 * which left the Audience tab offering no CSV at all while burning a core.
 *
 * Keeping the rows in a ref and re-rendering only when the KEYS change breaks
 * that cycle without going stale: the menu is drawn from the keys, and the
 * rows are read from the ref at the moment somebody clicks.
 */
export function ExportProvider({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  const datasets = useRef<Dataset[]>([])
  const [signature, setSignature] = useState('')

  const register = useCallback((r: Registration | null) => {
    datasets.current = r?.datasets ?? []
    const next = datasets.current.map((d) => `${d.key}\u0000${d.label}`).join('|')
    setSignature((prev) => (prev === next ? prev : next))
  }, [])

  const menu = useMemo(
    () => (signature === '' ? [] : datasets.current.map((d) => ({ key: d.key, label: d.label }))),
    [signature],
  )

  const value = useMemo(
    () => ({ menu, prefix, current: () => datasets.current, register }),
    [menu, prefix, register],
  )

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>
}

/**
 * Offer this view's tables for export.
 *
 * `deps` is the caller's business, as with any effect: the datasets close over
 * the view's data, so they have to be re-registered when it changes or the
 * button exports the previous artist's numbers.
 */
export function useExport(datasets: Dataset[], deps: unknown[]) {
  const { register } = useContext(ExportContext)
  const latest = useRef(datasets)
  latest.current = datasets

  useEffect(() => {
    register({ prefix: '', datasets: latest.current })
    return () => register(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function ExportButton() {
  const { menu, prefix, current } = useContext(ExportContext)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const take = (key: string, label: string) => {
    setOpen(false)
    // Looked up at click time, not captured when the menu was drawn: the view
    // may have refetched since, and the rows must be the ones on screen.
    const d = current().find((x) => x.key === key)
    if (!d) return
    if (!downloadCsv(`${prefix}-${d.key}`, d.rows())) {
      // An empty table is not a failure worth a dialog, but silence reads as a
      // broken button.
      window.alert(`${label} has no rows in this range.`)
    }
  }

  /**
   * Every table on the tab as one workbook, a sheet each.
   *
   * One file rather than one per table: the tables on a tab are one answer,
   * and somebody forwarding "the numbers" should be attaching one thing. The
   * CSV entries stay below for anything that feeds a script.
   *
   * Built in the browser from the same rows the CSV uses, so a workbook and
   * the screen cannot disagree — and the writer is the one the server uses,
   * not a second implementation.
   */
  const toXlsx = () => {
    setOpen(false)
    if (!downloadXlsx(`${prefix}-tables`, current())) {
      window.alert('Nothing on this tab has rows in this range.')
    }
  }

  /*
   * PDF is the browser's own print-to-PDF, not a generated document.
   *
   * The alternative was a PDF library, which would mean redrawing every chart
   * into it — the charts here are SVG, and a library would either rasterise
   * them into something blurry or need every one rebuilt in its own drawing
   * API. Printing keeps the real charts as vectors, keeps whatever is actually
   * on screen honest, costs no dependency, and works offline. The print
   * stylesheet does the work of making the page look deliberate on paper.
   */
  const toPdf = () => {
    setOpen(false)
    // A tick, so the menu is closed before the print snapshot is taken.
    window.setTimeout(() => window.print(), 50)
  }

  if (menu.length === 0) {
    // Still offers the PDF: a tab with no table still has a page worth keeping.
    return (
      <div className="export-wrap" ref={box}>
        <button className="control" aria-haspopup="menu" aria-expanded={open}
          onClick={() => setOpen((v) => !v)}>
          Export ▾
        </button>
        {open ? (
          <div className="export-menu" role="menu">
            <button role="menuitem" onClick={toPdf}>This page as PDF</button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className="export-wrap" ref={box}>
      <button className="control" aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}>
        Export ▾
      </button>
      {open ? (
        <div className="export-menu" role="menu">
          <button role="menuitem" onClick={toPdf}>This page as PDF</button>
          <button role="menuitem" onClick={toXlsx}>
            {menu.length > 1 ? 'All tables (Excel)' : `${menu[0]!.label} (Excel)`}
          </button>
          <div className="export-sep" role="separator" />
          {menu.map((d) => (
            <button key={d.key} role="menuitem" onClick={() => take(d.key, d.label)}>
              {d.label} (CSV)
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
