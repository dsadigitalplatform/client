import 'server-only'

import type { Db, ObjectId } from 'mongodb'

import {
  ensureUniqueBankCode,
  escapeRegex,
  generateBankCodeFromName,
  normalizeBankCode
} from '@/app/api/banks/_helpers'

export type MigrateBanksFromLoanCasesResult = {
  scanned: number
  imported: number
  skipped: number
  names: string[]
}

export async function migrateBanksFromLoanCases(
  db: Db,
  tenantIdObj: ObjectId,
  createdBy: ObjectId
): Promise<MigrateBanksFromLoanCasesResult> {
  const tenantIdHex = tenantIdObj.toHexString()

  const rows = await db
    .collection('loanCases')
    .aggregate([
      { $match: { tenantId: { $in: [tenantIdObj, tenantIdHex] }, bankName: { $type: 'string' } } },
      { $project: { bankName: { $trim: { input: '$bankName' } } } },
      { $match: { bankName: { $ne: '' } } },
      { $group: { _id: { $toLower: '$bankName' }, value: { $first: '$bankName' } } },
      { $sort: { value: 1 } }
    ])
    .toArray()

  let imported = 0
  let skipped = 0
  const names: string[] = []

  for (const row of rows) {
    const name = String((row as any).value || '').trim()

    if (!name) continue

    names.push(name)

    const existingByName = await db.collection('banks').findOne({
      tenantId: tenantIdObj,
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    })

    if (existingByName) {
      skipped += 1
      continue
    }

    const baseCode = generateBankCodeFromName(name)
    const code = await ensureUniqueBankCode(db, tenantIdObj, baseCode)
    const now = new Date()

    await db.collection('banks').insertOne({
      tenantId: tenantIdObj,
      code,
      codeNormalized: normalizeBankCode(code),
      name,
      description: 'Imported from lead manager',
      createdBy,
      createdAt: now,
      updatedAt: now
    })

    imported += 1
  }

  return {
    scanned: rows.length,
    imported,
    skipped,
    names
  }
}
