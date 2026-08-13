import type { Db, ObjectId } from 'mongodb'

import { generateBusinessCode } from '@features/code-generation/server/codeGenerator.server'

type GenerateBankCodeParams = {
  db: Db
  tenantId: ObjectId
  name: string
  preview?: boolean
  excludeId?: ObjectId
  date?: Date
}

/** Generate a bank business code using the tenant BANK code-generation template. */
export async function generateBankBusinessCode(params: GenerateBankCodeParams) {
  const { db, tenantId, name, preview, excludeId, date } = params
  const trimmedName = String(name || '').trim()

  return generateBusinessCode({
    db,
    tenantId,
    entityType: 'BANK',
    context: {
      recordName: trimmedName,
      bankName: trimmedName,
      date: date || new Date()
    },
    preview,
    excludeId
  })
}
