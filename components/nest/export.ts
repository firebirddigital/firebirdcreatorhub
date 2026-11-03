/**
 * CSV built in the browser from what is already on screen.
 *
 * No server round trip and no second source of truth: every export is the rows
 * the tab is rendering, so a spreadsheet and the screen can never disagree. A
 * tab that is showing a warning instead of data exports nothing, which is the
 * honest outcome.
 */

import { buildXlsx, type Cell as XlsxCell, type Column, type Sheet } from './xlsx'

export type Cell = string | number | boolean | null | undefined

/** One exportable table: a name for the file, and the rows as they are displayed. */
export interface Dataset {
  /** Slug-ish, used in the filename: "posts", "by-network". */
  key: string
  /** What the menu calls it. */
  label: string
  /** Built lazily — a tab with six tables should not serialise five it is not asked for. */
  rows: () => Array<Record<string, Cell>>
}

/* Short forms a Sentence-case header should keep shouting. */
const ACRONYMS: Record<string, string> = {
  id: 'ID', ids: 'IDs', url: 'URL', urls: 'URLs', sms: 'SMS', crm: 'CRM',
  ugc: 'UGC', api: 'API', iso: 'ISO', usd: 'USD', aov: 'AOV', cpm: 'CPM',
  cpc: 'CPC', roi: 'ROI', ctr: 'CTR', uk: 'UK', us: 'US', tiktok: 'TikTok',
  youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook',
  spotify: 'Spotify', chartmetric: 'Chartmetric', pdf: 'PDF', csv: 'CSV',
}

/**
 * "listener_change_pct" -> "Listener change %".
 *
 * A column header is read by a person, usually in a spreadsheet they have
 * pasted into a deck. Raw keys are what the code calls things, and shipping
 * them makes every export look like a database dump.
 */
export function title(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // camelCase arrives from a few places
    .split(/[_\s-]+/)
    .filter(Boolean)

  const pct = words.at(-1) === 'pct'
  const kept = pct ? words.slice(0, -1) : words

  const out = kept.map((w, i) => {
    const lower = w.toLowerCase()
    if (ACRONYMS[lower]) return ACRONYMS[lower]
    return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower
  }).join(' ')

  return (pct ? `${out} %` : out) || key
}

/**
 * Float noise, trimmed.
 *
 * A share computed as 1/6 serialises as 0.16666666666666666, which is sixteen
 * digits of nothing anybody asked for. Integers are left exactly as they are —
 * a follower count must never be rounded.
 */
function num(v: number): string {
  if (!Number.isFinite(v)) return ''
  if (Number.isInteger(v)) return String(v)
  return String(Number(v.toFixed(6)))
}

/**
 * Does this text need quoting?
 *
 * Quoting everything is valid CSV and unreadable as a file. Quote only what
 * would otherwise break a parser.
 */
const needsQuotes = (s: string) => /[",\r\n]/.test(s) || s !== s.trim()

/**
 * A field starting with =, +, - or @ is executed as a formula by Excel, Sheets
 * and Numbers on open, so it is prefixed with an apostrophe to force text —
 * which is what a phone number like "+447956872105" was meant to be.
 *
 * NOT for an actual number. The old rule caught every negative value in the
 * app: "-12.4" became the text "'-12.4", so a column of changes arrived in a
 * spreadsheet that could not sum it. A value that parses as a number is left
 * alone, because a number cannot be a formula.
 */
function cell(v: Cell): string {
  if (v == null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return num(v)

  const s = String(v)
  if (s === '') return ''
  // A numeric string is a number somebody stored as text; treat it as a number.
  const numeric = /^-?\d+(\.\d+)?$/.test(s.trim())
  const safe = !numeric && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return needsQuotes(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/*
 * Union of every row's keys, not just the first row's. Rows built from
 * different branches legitimately differ — a streaming platform has no
 * engagement rate — and taking the first row's shape would silently drop whole
 * columns. Shared, so a CSV and a workbook of the same table cannot end up
 * with different columns.
 */
export function columnsOf(rows: Array<Record<string, Cell>>): string[] {
  const columns: string[] = []
  for (const row of rows) for (const k of Object.keys(row)) if (!columns.includes(k)) columns.push(k)
  return columns
}

export function toCsv(rows: Array<Record<string, Cell>>): string {
  if (rows.length === 0) return ''
  const columns = columnsOf(rows)

  return [
    columns.map((c) => cell(title(c))).join(','),
    ...rows.map((r) => columns.map((c) => cell(r[c])).join(',')),
  ].join('\r\n')
}

/** Safe for a filename on any platform, and readable afterwards. */
const slug = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'

export function downloadCsv(name: string, rows: Array<Record<string, Cell>>): boolean {
  const csv = toCsv(rows)
  if (!csv) return false
  // A BOM, so Excel opens UTF-8 as UTF-8 rather than mangling every accent.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(name)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return true
}


/* ------------------------------ workbook ------------------------------ */

/**
 * One cell, for the workbook rather than for CSV.
 *
 * The whole point of .xlsx over .csv is that a number arrives as a number, so
 * this keeps the type instead of stringifying everything. Float noise is
 * trimmed the same way the CSV does — a share of 1/6 is not sixteen digits —
 * and integers are never touched, because a follower count must not be rounded.
 *
 * A numeric-looking STRING stays a string. CSV converts those, because there
 * the alternative is a formula-injection guard that leaves a stray apostrophe;
 * here there is no such pressure, and turning "007" into 7 would quietly
 * corrupt an id.
 */
function xlsxCell(v: Cell): XlsxCell {
  if (v == null || v === '') return null
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null
    return Number.isInteger(v) ? v : Number(v.toFixed(6))
  }
  return String(v)
}

/** Roughly the width of that many characters, bounded so one long caption does
 *  not push every other column off the screen. */
function widthFor(header: string, rows: Array<Record<string, Cell>>, key: string): number {
  let longest = header.length
  // A sample, not the whole table: 50,000 rows to size a column is wasted work.
  for (const r of rows.slice(0, 300)) {
    const len = r[key] == null ? 0 : String(r[key]).length
    if (len > longest) longest = len
  }
  return Math.min(Math.max(longest + 2, 10), 42)
}

function sheetFor(label: string, rows: Array<Record<string, Cell>>, banner?: string): Sheet {
  const keys = columnsOf(rows)
  const columns: Column[] = keys.map((k) => ({
    header: title(k),
    width: widthFor(title(k), rows, k),
    /* Number formatting follows the DATA, not the column name. A column of
       strings that happens to be called "count" should not be right-aligned
       and comma-grouped. */
    format: rows.some((r) => typeof r[k] === 'number') ? 'number' : 'text',
  }))
  return {
    name: label,
    columns,
    rows: rows.map((r) => keys.map((k) => xlsxCell(r[k]))),
    banner,
  }
}

/**
 * Every table on the tab, as one workbook with a sheet each.
 *
 * One file rather than one per table: the tables on a tab are one answer, and
 * a manager forwarding "the numbers" should attach one thing. The CSV entries
 * stay for anything that feeds a script.
 *
 * Returns false when there is genuinely nothing — an empty workbook would open
 * to a blank grid and read as a broken export.
 */
export function downloadXlsx(
  name: string,
  datasets: Array<{ key: string; label: string; rows: () => Array<Record<string, Cell>> }>,
  banner?: string,
): boolean {
  const sheets = datasets
    .map((d) => ({ label: d.label, rows: d.rows() }))
    .filter((d) => d.rows.length > 0)
    .map((d) => sheetFor(d.label, d.rows, banner))
  if (sheets.length === 0) return false

  const blob = new Blob([buildXlsx(sheets)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${slug(name)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
  return true
}

/** "caamp-posts-2026-07-06-to-2026-10-04" */
export const exportName = (parts: Array<string | null | undefined>) =>
  parts.filter(Boolean).join('-')
