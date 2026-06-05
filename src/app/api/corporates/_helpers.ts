import type { Db, ObjectId } from 'mongodb'

export function normalizeCorporateCode(code: string) {
  return code.trim().toLowerCase()
}

export async function findDuplicateCorporateCode(
  db: Db,
  tenantIdObj: ObjectId,
  code: string,
  excludeId?: ObjectId
) {
  const codeNormalized = normalizeCorporateCode(code)

  const filter: Record<string, unknown> = {
    tenantId: tenantIdObj,
    codeNormalized
  }

  if (excludeId) filter._id = { $ne: excludeId }

  return db.collection('corporates').findOne(filter, { projection: { _id: 1, code: 1 } })
}

export const DUPLICATE_CORPORATE_CODE_ERROR = {
  error: 'duplicate_code',
  message: 'Corporate code already exists for this organisation',
  details: { code: 'This code is already in use for this organisation' }
} as const
