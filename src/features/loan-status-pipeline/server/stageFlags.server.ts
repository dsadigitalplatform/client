import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

import { validateStageFlags as validateStageFlagsShared, type StageFlags } from '../stageFlags'

export function validateStageFlags(flags: StageFlags): Record<string, string> {
  return validateStageFlagsShared(flags)
}

export async function enforceUniqueStageFlags(
  db: Db,
  tenantIdObj: ObjectId,
  stageId: ObjectId,
  flags: StageFlags
) {
  const now = new Date()
  const col = db.collection('loanStatusPipelineStages')

  if (flags.isDisbursed) {
    await col.updateMany(
      { tenantId: tenantIdObj, _id: { $ne: stageId }, isDisbursed: true },
      { $set: { isDisbursed: false, updatedAt: now } }
    )
  }

  if (flags.isClosed) {
    await col.updateMany(
      { tenantId: tenantIdObj, _id: { $ne: stageId }, isClosed: true },
      { $set: { isClosed: false, updatedAt: now } }
    )
  }

  if (flags.isRejected) {
    await col.updateMany(
      { tenantId: tenantIdObj, _id: { $ne: stageId }, isRejected: true },
      { $set: { isRejected: false, updatedAt: now } }
    )
  }
}
