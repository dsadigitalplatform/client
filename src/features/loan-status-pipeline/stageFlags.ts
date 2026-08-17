export type StageFlags = {
  isLoggedIn: boolean
  isDisbursed: boolean
  isClosed: boolean
  isRejected: boolean
}

export type PipelineStageLike = {
  id: string
  name: string
  order?: number
  isLoggedIn?: boolean
  isDisbursed?: boolean
  isClosed?: boolean
  isRejected?: boolean
}

export function emptyStageFlags(): StageFlags {
  return { isLoggedIn: false, isDisbursed: false, isClosed: false, isRejected: false }
}

export function countSelectedStageFlags(flags: StageFlags) {
  return [flags.isLoggedIn, flags.isDisbursed, flags.isClosed, flags.isRejected].filter(Boolean).length
}

export function validateStageFlags(flags: StageFlags): Record<string, string> {
  const errors: Record<string, string> = {}

  if (countSelectedStageFlags(flags) > 1) {
    errors.stageFlags = 'Select only one: Logged In, Disbursed, Closed, or Rejected'
  }

  return errors
}

function idsWhere(stages: PipelineStageLike[], pred: (s: PipelineStageLike) => boolean, nameRe?: RegExp) {
  const flagged = stages.filter(pred).map(s => s.id)

  if (flagged.length > 0) return flagged
  if (!nameRe) return []

  return stages.filter(s => nameRe.test(s.name)).map(s => s.id)
}

export function findLoggedInStageIds(stages: PipelineStageLike[]) {
  return idsWhere(stages, s => Boolean(s.isLoggedIn), /logged\s*in/i)
}

export function findDisbursedStageIds(stages: PipelineStageLike[]) {
  return idsWhere(stages, s => Boolean(s.isDisbursed), /disburs/i)
}

export function findClosedStageIds(stages: PipelineStageLike[]) {
  return idsWhere(stages, s => Boolean(s.isClosed), /\bclosed\b/i)
}

export function findRejectedStageIds(stages: PipelineStageLike[]) {
  return idsWhere(stages, s => Boolean(s.isRejected), /reject/i)
}

/** Files that should leave the live pipeline: disbursed, closed, or rejected. */
export function findTerminalStageIds(stages: PipelineStageLike[]) {
  const ids = new Set<string>([
    ...findDisbursedStageIds(stages),
    ...findClosedStageIds(stages),
    ...findRejectedStageIds(stages)
  ])

  if (ids.size > 0) return ids

  const last = stages.reduce<PipelineStageLike | null>((max, s) => {
    if (!max) return s
    if ((s.order || 0) > (max.order || 0)) return s

    return max
  }, null)

  return last ? new Set([last.id]) : new Set<string>()
}

/** Successfully finished files: disbursed or closed (not rejected). */
export function findCompletedStageIds(stages: PipelineStageLike[]) {
  const ids = new Set<string>([...findDisbursedStageIds(stages), ...findClosedStageIds(stages)])

  if (ids.size > 0) return ids

  const rejected = new Set(findRejectedStageIds(stages))
  const last = stages.reduce<PipelineStageLike | null>((max, s) => {
    if (!max) return s
    if ((s.order || 0) > (max.order || 0)) return s

    return max
  }, null)

  if (last && !rejected.has(last.id)) return new Set([last.id])

  return new Set<string>()
}
