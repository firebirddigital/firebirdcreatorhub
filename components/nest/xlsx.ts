/**
 * A minimal .xlsx writer.
 *
 * No dependency, for the same reason the rest of this server hand-rolls its
 * HTTP: the file we need is two sheets of strings and numbers with one header
 * style, and the OOXML surface for that is small and has not moved in fifteen
 * years. The spreadsheet libraries are large, and the most popular one is not
 * currently published to npm in a state worth depending on.
 *
 * An .xlsx is a ZIP of XML parts. This writes the five that Excel requires and
 * nothing else:
 *
 *   [Content_Types].xml        what each part is
 *   _rels/.rels                points at the workbook
 *   xl/workbook.xml            the sheet list
 *   xl/_rels/workbook.xml.rels maps sheet ids to files
 *   xl/styles.xml              the handful of formats used below
 *   xl/worksheets/sheetN.xml   one per sheet
 *
 * Strings are written inline (`t="inlineStr"`) rather than through a shared
 * string table. The table saves space when values repeat; this saves a part, a
 * second pass and a class of off-by-one bugs, and these files are small.
 *
 * No formula-injection guard is needed here, unlike the CSV path. Every string
 * is written as an inline string, never as `<f>`, so a cell beginning `=` or
 * `+` is text to Excel and stays text. The quoting trick CSV needs would show
 * up as a stray apostrophe in the cell.
 *
 * ⚠ DATES ARE WRITTEN AS TEXT, deliberately. Excel's date serial is days since
 * 1900 with a leap-year bug baked in, and getting it wrong silently shifts
 * every date by a day or four years. ISO `YYYY-MM-DD` sorts and filters
 * correctly as text, which is all a recap needs.
 */
/**
 * ⚠ NO NODE BUILTINS IN THIS FILE. It is bundled into the browser as well as
 * run on the server, so `node:zlib` and `Buffer` are both out — the compressor
 * is injected by the caller instead. The server passes zlib's deflate; the
 * browser passes nothing and the parts are STORED uncompressed, which a ZIP
 * reader handles natively. An export of a few thousand rows is then roughly a
 * megabyte instead of a hundred kilobytes, which is a download, not a problem;
 * the alternative is CompressionStream, which is async and would turn every
 * caller inside out for a saving nobody is waiting on.
 */

export type Cell = string | number | null | undefined

export interface Column {
  header: string
  /** Characters, not pixels. Roughly the width of that many digits. */
  width?: number
  format?: 'text' | 'number' | 'percent'
}

export interface Sheet {
  name: string
  columns: Column[]
  rows: Cell[][]
  /** A full-width note above the header — a provenance or warning line. */
  banner?: string
  /** Freeze below the header and turn on the filter dropdowns. Default true. */
  freeze?: boolean
}

/* ------------------------------- XML ------------------------------- */

/**
 * Escape text for XML, and drop what XML 1.0 cannot carry.
 *
 * Control characters are the real hazard: a stray 0x00..0x08 from an upstream
 * field makes the whole workbook unopenable, and Excel reports it as "unreadable
 * content" without saying which cell. Stripping them costs a character nobody
 * can see; keeping them costs the file.
 */
export function xmlText(s: string): string {
  return s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A1, B1 … Z1, AA1. Excel's column letters are base-26 with no zero. */
export function cellRef(col: number, row: number): string {
  let n = col + 1
  let name = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    name = String.fromCharCode(65 + rem) + name
    n = Math.floor((n - 1) / 26)
  }
  return `${name}${row}`
}

/* Style indexes into the cellXfs list in styles.xml below. */
const S_DEFAULT = 0
const S_HEADER = 1
const S_NUMBER = 2
const S_PERCENT = 3
const S_BANNER = 4

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0"/><numFmt numFmtId="165" formatCode="0.0%"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1A1A1A"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFED2124"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="bottom" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

function sheetXml(sheet: Sheet): string {
  const { columns, rows, banner } = sheet
  const freeze = sheet.freeze !== false
  const headerRow = banner ? 3 : 1
  const firstData = headerRow + 1

  const cols = columns.map((c, i) =>
    `<col min="${i + 1}" max="${i + 1}" width="${c.width ?? 14}" customWidth="1"/>`).join('')

  const out: string[] = []

  if (banner) {
    const cells = columns.map((_, i) =>
      `<c r="${cellRef(i, 1)}" s="${S_BANNER}"${i === 0
        ? ` t="inlineStr"><is><t>${xmlText(banner)}</t></is></c>`
        : '/>'}`).join('')
    // Every cell in the merged range carries the fill, or the colour stops at
    // the first column in some readers.
    out.push(`<row r="1" ht="22" customHeight="1">${cells}</row>`)
  }

  out.push(`<row r="${headerRow}">${columns.map((c, i) =>
    `<c r="${cellRef(i, headerRow)}" s="${S_HEADER}" t="inlineStr"><is><t>${xmlText(c.header)}</t></is></c>`,
  ).join('')}</row>`)

  rows.forEach((row, r) => {
    const rowNum = firstData + r
    const cells = row.map((v, i) => {
      const ref = cellRef(i, rowNum)
      if (v == null || v === '') return ''
      const fmt = columns[i]?.format
      if (typeof v === 'number' && Number.isFinite(v)) {
        const s = fmt === 'percent' ? S_PERCENT : fmt === 'text' ? S_DEFAULT : S_NUMBER
        return `<c r="${ref}" s="${s}"><v>${v}</v></c>`
      }
      return `<c r="${ref}" s="${S_DEFAULT}" t="inlineStr"><is><t>${xmlText(String(v))}</t></is></c>`
    }).join('')
    out.push(`<row r="${rowNum}">${cells}</row>`)
  })

  const lastRef = cellRef(Math.max(columns.length - 1, 0), firstData + rows.length - 1)
  /* Order matters: the schema requires sheetPr, dimension, sheetViews,
     sheetFormatPr, cols, sheetData, mergeCells, autoFilter — out of order and
     Excel rejects the part outright. */
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${lastRef}"/>
<sheetViews><sheetView workbookViewId="0">${freeze
    ? `<pane ySplit="${headerRow}" topLeftCell="${cellRef(0, firstData)}" activePane="bottomLeft" state="frozen"/>`
    : ''}</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${out.join('')}</sheetData>
${banner ? `<mergeCells count="1"><mergeCell ref="A1:${cellRef(columns.length - 1, 1)}"/></mergeCells>` : ''}
${freeze ? `<autoFilter ref="${cellRef(0, headerRow)}:${lastRef}"/>` : ''}
</worksheet>`
}

/* ------------------------------- ZIP ------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf: Uint8Array): number {
  let c = -1
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]!) & 0xFF]! ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

interface Entry { name: string; data: Uint8Array }

/** Deflate, when the caller has one. Returning null means "store this part". */
export type Deflate = (data: Uint8Array) => Uint8Array | null

/**
 * A ZIP archive, deflated.
 *
 * Written out by hand because node has zlib but no archiver. Only the fields
 * Excel reads are set; there is no zip64, which caps the archive at 4GB — a
 * recap that large is a different problem.
 */
function zip(entries: Entry[], deflate: Deflate | null): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  const encoder = new TextEncoder()
  let offset = 0

  const u8 = (len: number) => {
    const b = new Uint8Array(len)
    return { b, v: new DataView(b.buffer) }
  }

  for (const e of entries) {
    const name = encoder.encode(e.name)
    const crc = crc32(e.data)
    const deflated = deflate?.(e.data) ?? null
    // Only store compressed if it actually helped; tiny parts can grow.
    const useDeflate = deflated != null && deflated.length < e.data.length
    const body = useDeflate ? deflated : e.data
    const method = useDeflate ? 8 : 0

    const { b: local, v: lv } = u8(30 + name.length)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)          // version needed
    lv.setUint16(6, 0, true)           // flags
    lv.setUint16(8, method, true)
    lv.setUint16(10, 0, true)          // mod time
    lv.setUint16(12, 0x21, true)       // mod date — 1 Jan 1980, a fixed value
    lv.setUint32(14, crc, true)
    lv.setUint32(18, body.length, true)
    lv.setUint32(22, e.data.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)
    chunks.push(local, body)

    const { b: central, v: cv } = u8(46 + name.length)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)          // version made by
    cv.setUint16(6, 20, true)          // version needed
    cv.setUint16(8, 0, true)
    cv.setUint16(10, method, true)
    cv.setUint16(12, 0, true)
    cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, body.length, true)
    cv.setUint32(24, e.data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint16(30, 0, true)          // extra
    cv.setUint16(32, 0, true)          // comment
    cv.setUint16(34, 0, true)          // disk
    cv.setUint16(36, 0, true)          // internal attrs
    cv.setUint32(38, 0, true)          // external attrs
    cv.setUint32(42, offset, true)
    central.set(name, 46)
    centrals.push(central)

    offset += local.length + body.length
  }

  const centralSize = centrals.reduce((a, c) => a + c.length, 0)
  const { b: end, v: ev } = u8(22)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true)
  ev.setUint16(6, 0, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, centralSize, true)
  ev.setUint32(16, offset, true)
  ev.setUint16(20, 0, true)

  const all = [...chunks, ...centrals, end]
  const total = all.reduce((a, c) => a + c.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const c of all) { out.set(c, at); at += c.length }
  return out
}

/* ----------------------------- workbook ----------------------------- */

/**
 * Excel forbids : \ / ? * [ ] in a sheet name and caps it at 31 characters.
 * A name that breaks either rule makes the file unopenable rather than being
 * cleaned up on the way in, so it is cleaned up here.
 */
export function safeSheetName(name: string, taken: Set<string> = new Set()): string {
  let base = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Sheet'
  let out = base
  let n = 2
  while (taken.has(out.toLowerCase())) {
    const suffix = ` ${n}`
    out = base.slice(0, 31 - suffix.length) + suffix
    n += 1
  }
  taken.add(out.toLowerCase())
  return out
}

export function buildXlsx(sheets: Sheet[], deflate: Deflate | null = null): Uint8Array<ArrayBuffer> {
  if (sheets.length === 0) throw new Error('A workbook needs at least one sheet.')
  const taken = new Set<string>()
  const named = sheets.map((s) => ({ ...s, name: safeSheetName(s.name, taken) }))

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${named.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  /* Sheet rIds start after the styles relationship, not at 1 — an overlap here
     points a sheet at the stylesheet and the workbook will not open. */
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${named.map((s, i) =>
    `<sheet name="${xmlText(s.name)}" sheetId="${i + 1}" r:id="rId${i + 2}"/>`).join('')}</sheets>
</workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${named.map((_, i) => `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
</Relationships>`

  const encoder = new TextEncoder()
  const utf8 = (s: string) => encoder.encode(s)
  return zip([
    { name: '[Content_Types].xml', data: utf8(contentTypes) },
    { name: '_rels/.rels', data: utf8(rootRels) },
    { name: 'xl/workbook.xml', data: utf8(workbook) },
    { name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
    { name: 'xl/styles.xml', data: utf8(STYLES) },
    ...named.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`, data: utf8(sheetXml(s)),
    })),
  ], deflate)
}
