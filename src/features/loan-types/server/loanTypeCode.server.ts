import type { Db, ObjectId } from 'mongodb'

import { generateBusinessCode } from '@features/code-generation/server/codeGenerator.server'

type GenerateLoanTypeCodeParams = {
  db: Db
  tenantId: ObjectId
  name: string
  preview?: boolean
  excludeId?: ObjectId
  date?: Date
}

/** Generate a loan type business code using the tenant LOAN_TYPE code-generation template. */
export async function generateLoanTypeBusinessCode(params: GenerateLoanTypeCodeParams) {
  const { db, tenantId, name, preview, excludeId, date } = params
  const trimmedName = String(name || '').trim()

  return generateBusinessCode({
    db,
    tenantId,
    entityType: 'LOAN_TYPE',
    context: {
      recordName: trimmedName,
      loanTypeName: trimmedName,
      date: date || new Date()
    },
    preview,
    excludeId
  })
}
