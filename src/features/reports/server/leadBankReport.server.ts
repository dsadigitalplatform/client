import type { Db, ObjectId } from 'mongodb'

import { findBankByName } from '@/app/api/banks/_helpers'
import { escapeRegexLiteral } from '@features/reports/server/reportContext.server'

/** Resolve the display name from the linked bank, then the legacy lead field. */
export function leadBankResolutionStages(tenantIdObj: ObjectId, tenantIdHex: string) {
  return [
    {
      $lookup: {
        from: 'banks',
        let: {
          bankIdObj: { $convert: { input: '$bankId', to: 'objectId', onError: null, onNull: null } },
          bankCodeNorm: {
            $toLower: {
              $trim: {
                input: {
                  $toString: { $ifNull: ['$bankCode', ''] }
                }
              }
            }
          }
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $in: ['$tenantId', [tenantIdObj, tenantIdHex]] },
                  {
                    $or: [
                      { $eq: ['$_id', '$$bankIdObj'] },
                      {
                        $and: [{ $ne: ['$$bankCodeNorm', ''] }, { $eq: ['$codeNormalized', '$$bankCodeNorm'] }]
                      }
                    ]
                  }
                ]
              }
            }
          },
          { $project: { name: 1, code: 1 } }
        ],
        as: 'bank'
      }
    },
    { $unwind: { path: '$bank', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        resolvedBankName: {
          $let: {
            vars: {
              linked: {
                $trim: {
                  input: { $toString: { $ifNull: ['$bank.name', ''] } }
                }
              },
              legacy: {
                $trim: {
                  input: { $toString: { $ifNull: ['$bankName', ''] } }
                }
              }
            },
            in: {
              $cond: [
                { $ne: ['$$linked', ''] },
                '$$linked',
                { $cond: [{ $ne: ['$$legacy', ''] }, '$$legacy', null] }
              ]
            }
          }
        }
      }
    }
  ]
}

/**
 * Match leads linked by bankId/bankCode, and older leads that still store bankName.
 * Returned as a single clause so it can be ANDed with a role $or.
 */
export async function buildLeadBankNameMatch(db: Db, tenantIdObj: ObjectId, bankName: string | null) {
  const trimmed = bankName?.trim()

  if (!trimmed) return null

  const bank = await findBankByName(db, tenantIdObj, trimmed)
  const orConditions: Record<string, unknown>[] = []

  if (bank) {
    orConditions.push({ bankId: bank._id })

    if (bank.code) {
      const safeCode = escapeRegexLiteral(bank.code)

      orConditions.push({ bankCode: { $regex: `^${safeCode}$`, $options: 'i' } })
    }
  }

  orConditions.push({
    $expr: {
      $eq: [
        {
          $toLower: {
            $trim: {
              input: {
                $toString: { $ifNull: ['$bankName', ''] }
              }
            }
          }
        },
        trimmed.toLowerCase()
      ]
    }
  })

  return { $or: orConditions }
}

export function applyLeadBankMatch(filter: Record<string, unknown>, bankMatch: Record<string, unknown> | null) {
  if (!bankMatch) return filter

  const existing = Array.isArray(filter.$and) ? filter.$and : []

  filter.$and = [...existing, bankMatch]

  return filter
}
