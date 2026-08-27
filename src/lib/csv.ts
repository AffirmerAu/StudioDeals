/**
 * CSV generation and download. Deliberately hand-rolled: the escaping rule is
 * four lines, and a dependency would be more code than this file.
 */

/** RFC 4180: quote anything containing a comma, quote, or newline, and double
 *  any quote inside. A leading = + - @ is prefixed with a tab as well, so a
 *  value like "=1+1" is text in Excel rather than a formula. */
function escapeCell(value: string): string {
  const guarded = /^[=+\-@]/.test(value) ? `\t${value}` : value
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const lines = [headers.map(escapeCell).join(',')]
  for (const row of rows) {
    lines.push(row.map((cell) => escapeCell(cell === null ? '' : String(cell))).join(','))
  }
  // CRLF, which is what Excel expects; a ﻿ BOM so it opens as UTF-8
  // rather than mangling names with accents in them.
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** Integer cents to a plain decimal a spreadsheet will read as a number.
 *  Never formatCents here — "$12,000" is text, and a column of text does not
 *  add up. */
export function centsToCsvNumber(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** A timestamp is trimmed to the date: nothing in these exports is
 *  time-of-day, and Excel reads a bare date far more reliably. */
export function toCsvDate(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

export function downloadCsv(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Revoking immediately can cancel the download in some browsers; a tick is
  // enough for the navigation to have started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** e.g. deals-2026-08-27.csv — dated, so successive exports don't overwrite. */
export function datedFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`
}
