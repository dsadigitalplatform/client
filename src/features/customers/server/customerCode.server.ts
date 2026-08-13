import type { Db, ObjectId } from 'mongodb'

import { generateBusinessCode } from '@features/code-generation/server/codeGenerator.server'

type GenerateCustomerCodeParams = {
  db: Db
  tenantId: ObjectId
  fullName: string
  preview?: boolean
  excludeId?: ObjectId
  date?: Date
}

/** Generate a customer business code using the tenant CUSTOMER code-generation template. */
export async function generateCustomerBusinessCode(params: GenerateCustomerCodeParams) {
  const { db, tenantId, fullName, preview, excludeId, date } = params
  const trimmedName = String(fullName || '').trim()

  return generateBusinessCode({
    db,
    tenantId,
    entityType: 'CUSTOMER',
    context: {
      recordName: trimmedName,
      customerName: trimmedName,
      date: date || new Date()
    },
    preview,
    excludeId
  })
}
