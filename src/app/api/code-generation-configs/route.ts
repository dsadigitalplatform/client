export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import {
  generateBusinessCode,
  getOrCreateCodeConfig,
  listCodeConfigsForTenant,
  validateTemplate
} from '@features/code-generation/server/codeGenerator.server'
import { CODE_TOKEN_HINTS, ENTITY_CODE_META, isCodeEntityType } from '@features/code-generation/server/entityCodeMeta'
import { escapeRegex, leadNeedsBankLinkPatch, normalizeBankCode, repairLeadBankLink } from '@/app/api/banks/_helpers'
import { normalizeCorporateCode } from '@/app/api/corporates/_helpers'
import { generateAdvocateBusinessCode } from '@features/advocates/server/advocateCode.server'
import { generateAssociateBusinessCode } from '@features/associates/server/associateCode.server'
import { generateBankBusinessCode } from '@features/banks/server/bankCode.server'
import { generateCorporateBusinessCode } from '@features/corporates/server/corporateCode.server'
import { generateCustomerBusinessCode } from '@features/customers/server/customerCode.server'
import { generateLoanTypeBusinessCode } from '@features/loan-types/server/loanTypeCode.server'
import { getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

function requireAdmin(role: string) {
  return role === 'OWNER' || role === 'ADMIN'
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error
  if (!requireAdmin(ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const configs = await listCodeConfigsForTenant(ctx.db, ctx.tenantIdObj)

  return NextResponse.json({
    configs,
    tokens: CODE_TOKEN_HINTS
  })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error
  if (!requireAdmin(ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const entityType = body?.entityType
  const template = String(body?.template ?? '').trim()
  const prefix = String(body?.prefix || '').trim().toUpperCase()
  const sequencePadLength = Number(body?.sequencePadLength)

  if (!isCodeEntityType(entityType)) {
    return NextResponse.json({ error: 'validation_error', details: { entityType: 'Invalid entity type' } }, { status: 400 })
  }

  const errors: Record<string, string> = {}
  const templateError = validateTemplate(template)

  if (templateError) errors.template = templateError
  if (!prefix) errors.prefix = 'Prefix is required'
  else if (prefix.length > 8) errors.prefix = 'Prefix must be at most 8 characters'
  if (!(Number.isInteger(sequencePadLength) && sequencePadLength >= 1 && sequencePadLength <= 8)) {
    errors.sequencePadLength = 'Sequence pad length must be 1–8'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  await getOrCreateCodeConfig(ctx.db, ctx.tenantIdObj, entityType)

  await ctx.db.collection('codeGenerationConfigs').updateOne(
    { tenantId: ctx.tenantIdObj, entityType },
    {
      $set: {
        isEnabled: true,
        template,
        prefix,
        sequencePadLength,
        updatedAt: new Date(),
        updatedBy: ctx.userId
      }
    }
  )

  const configs = await listCodeConfigsForTenant(ctx.db, ctx.tenantIdObj)

  return NextResponse.json({
    configs,
    tokens: CODE_TOKEN_HINTS
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error
  if (!requireAdmin(ctx.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const action = String(body?.action || 'preview')
  const entityType = body?.entityType

  if (!isCodeEntityType(entityType)) {
    return NextResponse.json({ error: 'validation_error', details: { entityType: 'Invalid entity type' } }, { status: 400 })
  }

  if (action === 'preview') {
    const template = body?.template != null ? String(body.template).trim() : undefined
    const prefix = body?.prefix != null ? String(body.prefix).trim().toUpperCase() : undefined
    const sequencePadLength = body?.sequencePadLength != null ? Number(body.sequencePadLength) : undefined

    if (template) {
      const templateError = validateTemplate(template)

      if (templateError) {
        return NextResponse.json({ error: 'validation_error', details: { template: templateError } }, { status: 400 })
      }
    }

    try {
      const previewContext =
        entityType === 'BANK'
          ? {
              recordName: body?.recordName || body?.bankName || 'HDFC Bank',
              bankName: body?.bankName || body?.recordName || 'HDFC Bank'
            }
          : entityType === 'ASSOCIATE'
            ? {
                recordName: body?.recordName || body?.associateName || 'Rajesh Kumar',
                companyName: body?.companyName || 'Alpha Finance Pvt Ltd'
              }
            : entityType === 'CUSTOMER'
              ? {
                  recordName: body?.recordName || body?.customerName || body?.fullName || 'Rajesh Kumar',
                  customerName: body?.customerName || body?.fullName || body?.recordName || 'Rajesh Kumar'
                }
              : entityType === 'CORPORATE'
                ? {
                    recordName: body?.recordName || body?.name || 'Alpha Corp Pvt Ltd'
                  }
                : entityType === 'LOAN_TYPE'
                  ? {
                      recordName: body?.recordName || body?.name || body?.loanTypeName || 'Home Loan',
                      loanTypeName: body?.loanTypeName || body?.name || body?.recordName || 'Home Loan'
                    }
                  : entityType === 'ADVOCATE'
                    ? {
                        recordName: body?.recordName || body?.name || 'Rajesh Kumar'
                      }
                    : {
              customerName: body?.customerName || 'Rajesh Kumar',
              loanTypeName: body?.loanTypeName || 'Home Loan',
              loanTypeCode: body?.loanTypeCode || 'HL',
              bankName: body?.bankName || 'HDFC Bank',
              bankCode: body?.bankCode || 'HDFC',
              recordName: body?.recordName || 'Rajesh Kumar'
            }

      const preview = await generateBusinessCode({
        db: ctx.db,
        tenantId: ctx.tenantIdObj,
        entityType,
        context: previewContext,
        preview: true,
        overrides: {
          ...(template !== undefined ? { template } : {}),
          ...(prefix ? { prefix } : {}),
          ...(sequencePadLength != null && Number.isFinite(sequencePadLength) ? { sequencePadLength } : {})
        }
      })

      return NextResponse.json({ preview })
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'preview_failed' }, { status: 400 })
    }
  }

  if (action === 'reapply') {
    const meta = ENTITY_CODE_META[entityType]

    if (!meta.isWired) {
      return NextResponse.json(
        { error: 'not_wired', message: `${meta.label} code generation is not wired yet` },
        { status: 400 }
      )
    }

    const reapplyEntityTypes = ['LEAD', 'BANK', 'ASSOCIATE', 'CUSTOMER', 'CORPORATE', 'LOAN_TYPE', 'ADVOCATE'] as const

    if (!reapplyEntityTypes.includes(entityType as (typeof reapplyEntityTypes)[number])) {
      return NextResponse.json(
        { error: 'unsupported', message: 'Reapply is not supported for this entity type' },
        { status: 400 }
      )
    }

    const onlyMissing = body?.onlyMissing !== false
    const limit = Math.min(500, Math.max(1, Number(body?.limit) || 200))

    const filter: Record<string, unknown> = { tenantId: ctx.tenantIdObj }

    if (onlyMissing) {
      if (entityType === 'LEAD') {
        filter.$or = [
          { code: { $exists: false } },
          { code: null },
          { code: '' },
          { bankId: { $exists: false } },
          { bankId: null },
          { bankCode: { $exists: false } },
          { bankCode: null },
          { bankCode: '' },
          {
            bankName: { $type: 'string', $nin: ['', null] },
            $or: [{ bankId: { $exists: false } }, { bankId: null }]
          }
        ]
      } else {
        filter.$or = [{ code: { $exists: false } }, { code: null }, { code: '' }]
      }
    }

    const rows = await ctx.db
      .collection(meta.collectionName)
      .find(filter)
      .sort({ createdAt: 1 })
      .limit(limit)
      .toArray()

    let updated = 0
    let skipped = 0
    let failed = 0
    let banksRepaired = 0
    const errors: string[] = []

    for (const row of rows) {
      try {
        if (onlyMissing && entityType === 'BANK' && row.code && String(row.code).trim()) {
          skipped += 1
          continue
        }

        if (onlyMissing && entityType === 'ASSOCIATE' && row.code && String(row.code).trim()) {
          skipped += 1
          continue
        }

        if (onlyMissing && entityType === 'CUSTOMER' && row.code && String(row.code).trim()) {
          skipped += 1
          continue
        }

        if (onlyMissing && entityType === 'CORPORATE' && row.code && String(row.code).trim()) {
          skipped += 1
          continue
        }

        if (onlyMissing && entityType === 'LOAN_TYPE' && row.code && String(row.code).trim()) {
          skipped += 1
          continue
        }

        if (onlyMissing && entityType === 'ADVOCATE' && row.code && String(row.code).trim()) {
          skipped += 1
          continue
        }

        if (entityType === 'LOAN_TYPE') {
          const name = String((row as any).name || '').trim()

          if (!name) {
            skipped += 1
            continue
          }

          const code = await generateLoanTypeBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            name,
            excludeId: row._id as ObjectId,
            date: (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
          })

          await ctx.db.collection('loanTypes').updateOne(
            { _id: row._id },
            {
              $set: {
                code,
                updatedAt: new Date()
              }
            }
          )

          updated += 1
          continue
        }

        if (entityType === 'ADVOCATE') {
          const name = String((row as any).name || '').trim()

          if (!name) {
            skipped += 1
            continue
          }

          const code = await generateAdvocateBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            name,
            excludeId: row._id as ObjectId,
            date: (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
          })

          await ctx.db.collection('advocates').updateOne(
            { _id: row._id },
            {
              $set: {
                code,
                updatedAt: new Date()
              }
            }
          )

          updated += 1
          continue
        }

        if (entityType === 'CORPORATE') {
          const name = String((row as any).name || '').trim()

          if (!name) {
            skipped += 1
            continue
          }

          const code = await generateCorporateBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            name,
            excludeId: row._id as ObjectId,
            date: (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
          })

          await ctx.db.collection('corporates').updateOne(
            { _id: row._id },
            {
              $set: {
                code,
                codeNormalized: normalizeCorporateCode(code),
                updatedAt: new Date()
              }
            }
          )

          updated += 1
          continue
        }

        if (entityType === 'CUSTOMER') {
          const fullName = String((row as any).fullName || '').trim()

          if (!fullName) {
            skipped += 1
            continue
          }

          const code = await generateCustomerBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            fullName,
            excludeId: row._id as ObjectId,
            date: (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
          })

          await ctx.db.collection('customers').updateOne(
            { _id: row._id },
            {
              $set: {
                code,
                updatedAt: new Date()
              }
            }
          )

          updated += 1
          continue
        }

        if (entityType === 'ASSOCIATE') {
          const associateName = String((row as any).associateName || '').trim()
          const companyName = String((row as any).companyName || '').trim()

          if (!associateName || !companyName) {
            skipped += 1
            continue
          }

          const code = await generateAssociateBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            associateName,
            companyName,
            excludeId: row._id as ObjectId,
            date: (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
          })

          await ctx.db.collection('associates').updateOne(
            { _id: row._id },
            {
              $set: {
                code,
                updatedAt: new Date()
              }
            }
          )

          updated += 1
          continue
        }

        if (entityType === 'BANK') {
          const name = String((row as any).name || '').trim()

          if (!name) {
            skipped += 1
            continue
          }

          const oldCode = (row as any).code ? String((row as any).code) : null
          const code = await generateBankBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            name,
            excludeId: row._id as ObjectId,
            date: (row as any).createdAt ? new Date((row as any).createdAt) : new Date()
          })

          await ctx.db.collection('banks').updateOne(
            { _id: row._id },
            {
              $set: {
                code,
                codeNormalized: normalizeBankCode(code),
                updatedAt: new Date()
              }
            }
          )

          if (oldCode && oldCode !== code) {
            const bankName = String((row as any).name || '').trim()
            const leadMatchOr: Record<string, unknown>[] = [{ bankId: row._id }]

            if (oldCode) {
              leadMatchOr.push({ bankCode: oldCode })
              leadMatchOr.push({ bankName: { $regex: `^${escapeRegex(oldCode)}$`, $options: 'i' } })
            }

            if (bankName) {
              leadMatchOr.push({ bankName: { $regex: `^${escapeRegex(bankName)}$`, $options: 'i' } })
            }

            const leadUpdate = await ctx.db.collection('loanCases').updateMany(
              {
                tenantId: ctx.tenantIdObj,
                $or: leadMatchOr
              },
              {
                $set: {
                  bankId: row._id,
                  bankCode: code,
                  updatedAt: new Date()
                },
                $unset: { bankName: '' }
              }
            )

            banksRepaired += leadUpdate.modifiedCount
          }

          updated += 1
          continue
        }

        const repair = await repairLeadBankLink(ctx.db, ctx.tenantIdObj, {
          bankId: row.bankId,
          bankCode: row.bankCode,
          bankName: row.bankName
        })
        const bank = repair?.bank ?? null
        const shouldPatchBank = Boolean(bank && leadNeedsBankLinkPatch(row as any, bank))
        const shouldRegenCode = !onlyMissing || !row.code || !String(row.code).trim()

        if (!shouldRegenCode && !shouldPatchBank) {
          skipped += 1
          continue
        }

        const customer = row.customerId
          ? await ctx.db.collection('customers').findOne(
              { _id: row.customerId, tenantId: ctx.tenantIdObj },
              { projection: { fullName: 1 } }
            )
          : null
        const loanType = row.loanTypeId
          ? await ctx.db.collection('loanTypes').findOne(
              { _id: row.loanTypeId, tenantId: ctx.tenantIdObj },
              { projection: { name: 1, code: 1 } }
            )
          : null

        const updateSet: Record<string, unknown> = {
          updatedAt: new Date()
        }
        const updateUnset: Record<string, ''> = {}

        if (shouldPatchBank && bank) {
          updateSet.bankId = bank._id
          updateSet.bankCode = bank.code
          updateUnset.bankName = ''
          banksRepaired += 1
        }

        if (shouldRegenCode) {
          const code = await generateBusinessCode({
            db: ctx.db,
            tenantId: ctx.tenantIdObj,
            entityType,
            context: {
              customerName: customer ? String((customer as any).fullName || '') : '',
              loanTypeName: loanType ? String((loanType as any).name || '') : '',
              loanTypeCode: loanType ? String((loanType as any).code || '') || null : null,
              bankName: bank ? bank.name : null,
              bankCode: bank ? bank.code : null,
              date: row.createdAt ? new Date(row.createdAt) : new Date()
            },
            excludeId: row._id as ObjectId
          })

          updateSet.code = code
          updateSet.codePrevious = row.code ?? null
          updateSet.codeUpdatedAt = new Date()
        }

        await ctx.db.collection(meta.collectionName).updateOne(
          { _id: row._id },
          {
            $set: updateSet,
            ...(Object.keys(updateUnset).length > 0 ? { $unset: updateUnset } : {})
          }
        )
        updated += 1
      } catch (e: any) {
        failed += 1
        if (errors.length < 10) errors.push(e?.message || String(e))
      }
    }

    return NextResponse.json({
      entityType,
      scanned: rows.length,
      updated,
      skipped,
      failed,
      banksRepaired,
      errors
    })
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
