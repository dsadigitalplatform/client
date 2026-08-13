import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import {
  getOrCreateReferralSettings,
  updateReferralSettings
} from '@features/referrals/services/referrals.server'

function requireSuperAdmin(session: any) {
  return Boolean(session?.userId && (session.isSuperAdmin || session.user?.isSuperAdmin))
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = await getDb()
  const settings = await getOrCreateReferralSettings(db)

  return NextResponse.json({ settings })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  try {
    const db = await getDb()
    const settings = await updateReferralSettings(db, String((session as any).userId), {
      commissionPercent: typeof body.commissionPercent === 'number' ? body.commissionPercent : undefined,
      headline: typeof body.headline === 'string' ? body.headline : undefined,
      subheadline: typeof body.subheadline === 'string' ? body.subheadline : undefined,
      benefits: Array.isArray(body.benefits) ? body.benefits : undefined,
      termsHtml: typeof body.termsHtml === 'string' ? body.termsHtml : undefined,
      ctaLabel: typeof body.ctaLabel === 'string' ? body.ctaLabel : undefined
    })

    return NextResponse.json({ settings })
  } catch (e: any) {
    console.error('[super-admin/referrals/settings] PUT failed', e)

    return NextResponse.json(
      { error: 'save_failed', message: e?.message || 'Failed to save settings' },
      { status: 500 }
    )
  }
}
