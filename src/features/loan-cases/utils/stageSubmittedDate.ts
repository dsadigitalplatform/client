export type ParsedStageSubmittedDate = {
  date: Date
  isoDate: string
}

export function parseStageSubmittedDate(input: unknown): ParsedStageSubmittedDate | null {
  const raw = String(input ?? '').trim()

  if (!raw) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null

  const date = new Date(`${raw}T12:00:00.000Z`)

  if (Number.isNaN(date.getTime())) return null

  return { date, isoDate: raw }
}

export function todayStageSubmittedDateIso() {
  return new Date().toISOString().slice(0, 10)
}
