export type SpreadsheetCell = string | number

/** Excel number format: INR symbol + Indian grouping, summable numeric cells */
export const INR_CURRENCY_FORMAT = '"₹"#,##0.00'

const MIN_COLUMN_WIDTH = 8
const MAX_COLUMN_WIDTH = 48
const COLUMN_WIDTH_PADDING = 2

const inrDisplayFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

type XlsxCell = {
  t?: string
  v?: string | number | boolean
  z?: string
  w?: string
}

function formatInrDisplay(value: number) {
  return `₹${inrDisplayFormatter.format(value)}`
}

function cellDisplayLength(cell: XlsxCell | undefined) {
  if (!cell) return 0

  if (cell.t === 'n' && typeof cell.v === 'number') {
    if (cell.z === INR_CURRENCY_FORMAT) {
      return formatInrDisplay(cell.v).length
    }

    return String(cell.v).length
  }

  const text = cell.w ?? cell.v

  return text == null ? 0 : String(text).length
}

function autoFitWorksheetColumns(
  worksheet: Record<string, XlsxCell | string | unknown[] | undefined>,
  range: { s: { r: number; c: number }; e: { r: number; c: number } },
  encodeCell: (cell: { r: number; c: number }) => string
) {
  const columnCount = range.e.c - range.s.c + 1
  const maxWidths = Array.from({ length: columnCount }, () => MIN_COLUMN_WIDTH)

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = encodeCell({ r: row, c: col })
      const cell = worksheet[address] as XlsxCell | undefined
      const length = cellDisplayLength(cell)
      const index = col - range.s.c

      if (length + COLUMN_WIDTH_PADDING > maxWidths[index]) {
        maxWidths[index] = Math.min(length + COLUMN_WIDTH_PADDING, MAX_COLUMN_WIDTH)
      }
    }
  }

  worksheet['!cols'] = maxWidths.map(wch => ({ wch }))
}

export async function downloadSpreadsheet(rows: SpreadsheetCell[][], filename: string) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet(rows) as Record<string, XlsxCell | string | unknown[] | undefined>
  const rangeRef = worksheet['!ref']

  if (rangeRef) {
    const range = XLSX.utils.decode_range(String(rangeRef))

    for (let row = range.s.r; row <= range.e.r; row += 1) {
      for (let col = range.s.c; col <= range.e.c; col += 1) {
        const address = XLSX.utils.encode_cell({ r: row, c: col })
        const cell = worksheet[address] as XlsxCell | undefined

        if (!cell || cell.t !== 'n') continue

        cell.z = INR_CURRENCY_FORMAT
      }
    }

    autoFitWorksheetColumns(worksheet, range, XLSX.utils.encode_cell)
  }

  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')
  XLSX.writeFile(workbook, filename)
}
