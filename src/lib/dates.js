// Minimal, dependency-free CSV export. Handles quoting/escaping and triggers a
// browser download. Kept tiny to stay off any paid reporting service.

function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Quote if the cell contains comma, quote, or newline.
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// rows: array of objects; columns: [{ key, header }]
export function toCSV(rows, columns) {
  const head = columns.map((c) => escapeCell(c.header)).join(',')
  const body = rows
    .map((r) => columns.map((c) => escapeCell(r[c.key])).join(','))
    .join('\r\n')
  // Prepend a UTF-8 BOM so Excel opens Devanagari text correctly.
  return '﻿' + head + '\r\n' + body
}

export function downloadCSV(filename, rows, columns) {
  const csv = toCSV(rows, columns)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
