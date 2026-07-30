import { ObjectId, type Db, type ObjectId as ObjectIdType } from 'mongodb'

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

export function escapeRegex(value: string) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export type ResolvedBank = {
  _id: ObjectIdType
  code: string
  name: string
}

export async function findBankById(db: Db, tenantIdObj: ObjectIdType, bankId: string) {
  if (!ObjectId.isValid(bankId)) return null

  const row = await db.collection('banks').findOne(
    { _id: new ObjectId(bankId), tenantId: tenantIdObj },
    { projection: { _id: 1, code: 1, name: 1 } }
  )

  if (!row) return null

  return {
    _id: row._id as ObjectIdType,
    code: String((row as { code?: string }).code || ''),
    name: String((row as { name?: string }).name || '')
  } satisfies ResolvedBank
}

export async function findBankByCode(db: Db, tenantIdObj: ObjectIdType, code: string) {
  const trimmed = code.trim()

  if (!trimmed) return null

  const row = await db.collection('banks').findOne(
    {
      tenantId: tenantIdObj,
      codeNormalized: normalizeBankCode(trimmed)
    },
    { projection: { _id: 1, code: 1, name: 1 } }
  )

  if (!row) return null

  return {
    _id: row._id as ObjectIdType,
    code: String((row as { code?: string }).code || ''),
    name: String((row as { name?: string }).name || '')
  } satisfies ResolvedBank
}

export async function findBankByName(db: Db, tenantIdObj: ObjectIdType, name: string) {
  const trimmed = name.trim()

  if (!trimmed) return null

  const row = await db.collection('banks').findOne(
    {
      tenantId: tenantIdObj,
      name: { $regex: `^${escapeRegex(trimmed)}$`, $options: 'i' }
    },
    { projection: { _id: 1, code: 1, name: 1 } }
  )

  if (!row) return null

  return {
    _id: row._id as ObjectIdType,
    code: String((row as { code?: string }).code || ''),
    name: String((row as { name?: string }).name || '')
  } satisfies ResolvedBank
}

export async function resolveBankForLead(
  db: Db,
  tenantIdObj: ObjectIdType,
  input: { bankId?: string | null; bankCode?: string | null; bankName?: string | null }
): Promise<ResolvedBank | null> {
  if (input.bankId) {
    const bank = await findBankById(db, tenantIdObj, input.bankId)

    if (bank) return bank
  }

  if (input.bankCode?.trim()) {
    const bank = await findBankByCode(db, tenantIdObj, input.bankCode)

    if (bank) return bank
  }

  if (input.bankName?.trim()) {
    return findBankByName(db, tenantIdObj, input.bankName)
  }

  return null
}

export type LeadBankRepairResult = {
  bank: ResolvedBank
  matchedBy: 'bankId' | 'bankCode' | 'bankName' | 'legacyCodeInName'
}

/** Safely resolve a lead's bank from bankId, bankCode, bankName, or legacy name field holding a code. */
export async function repairLeadBankLink(
  db: Db,
  tenantIdObj: ObjectIdType,
  row: {
    bankId?: unknown
    bankCode?: unknown
    bankName?: unknown
  }
): Promise<LeadBankRepairResult | null> {
  const bankId = row.bankId ? String(row.bankId) : null
  const bankCode = row.bankCode ? String(row.bankCode).trim() : null
  const bankName = row.bankName ? String(row.bankName).trim() : null

  if (bankId) {
    const bank = await findBankById(db, tenantIdObj, bankId)

    if (bank) return { bank, matchedBy: 'bankId' }
  }

  if (bankCode) {
    const bank = await findBankByCode(db, tenantIdObj, bankCode)

    if (bank) return { bank, matchedBy: 'bankCode' }
  }

  if (bankName) {
    const byName = await findBankByName(db, tenantIdObj, bankName)

    if (byName) return { bank: byName, matchedBy: 'bankName' }

    const byLegacyCode = await findBankByCode(db, tenantIdObj, bankName)

    if (byLegacyCode) return { bank: byLegacyCode, matchedBy: 'legacyCodeInName' }
  }

  return null
}

export function leadNeedsBankLinkPatch(
  row: { bankId?: unknown; bankCode?: unknown; bankName?: unknown },
  bank: ResolvedBank
) {
  const linkedId = row.bankId ? String(row.bankId) : ''
  const linkedCode = row.bankCode ? String(row.bankCode).trim() : ''
  const legacyName = row.bankName ? String(row.bankName).trim() : ''
  const targetId = String(bank._id)

  return linkedId !== targetId || linkedCode !== bank.code || legacyName.length > 0
}
