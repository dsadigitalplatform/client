import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

export function validateStageFlags(isLoggedIn: boolean, isDisbursed: boolean): Record<string, string> {
  const errors: Record<string, string> = {}

  if (isLoggedIn && isDisbursed) {
    errors.stageFlags = 'Select either Logged In or Disbursed, not both'
  }

  return errors
}

export async function enforceUniqueStageFlags(
  db: Db,
  tenantIdObj: ObjectId,
  stageId: ObjectId,
  flags: { isLoggedIn: boolean; isDisbursed: boolean }
) {
  const now = new Date()

  if (flags.isLoggedIn) {
    await db.collection('loanStatusPipelineStages').updateMany(
      { tenantId: tenantIdObj, _id: { $ne: stageId }, isLoggedIn: true },
      { $set: { isLoggedIn: false, updatedAt: now } }
    )
  }

  if (flags.isDisbursed) {
    await db.collection('loanStatusPipelineStages').updateMany(
      { tenantId: tenantIdObj, _id: { $ne: stageId }, isDisbursed: true },
      { $set: { isDisbursed: false, updatedAt: now } }
    )
  }
}
