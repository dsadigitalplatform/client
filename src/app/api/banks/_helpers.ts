import type { Db, ObjectId } from 'mongodb'

export function normalizeBankCode(code: string) {
  return code.trim().toLowerCase()
}

export async function findDuplicateBankCode(db: Db, tenantIdObj: ObjectId, code: string, excludeId?: ObjectId) {
  const codeNormalized = normalizeBankCode(code)

  const filter: Record<string, unknown> = {
    tenantId: tenantIdObj,
    codeNormalized
  }

  if (excludeId) filter._id = { $ne: excludeId }

  return db.collection('banks').findOne(filter, { projection: { _id: 1, code: 1 } })
}

export const DUPLICATE_BANK_CODE_ERROR = {
  error: 'duplicate_code',
  message: 'Bank code already exists for this organisation',
  details: { code: 'This code is already in use for this organisation' }
} as const

export function generateBankCodeFromName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return base || 'bank'
}

export async function ensureUniqueBankCode(db: Db, tenantIdObj: ObjectId, baseCode: string) {
  let code = baseCode
  let suffix = 2

  while (await findDuplicateBankCode(db, tenantIdObj, code)) {
    code = `${baseCode}-${suffix}`
    suffix += 1
  }

  return code
}

export function escapeRegex(value: string) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export async function findBankByName(db: Db, tenantIdObj: ObjectId, name: string) {
  const trimmed = name.trim()

  if (!trimmed) return null

  return db.collection('banks').findOne(
    {
      tenantId: tenantIdObj,
      name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' }
    },
    { projection: { _id: 1, name: 1 } }
  )
}
