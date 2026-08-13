import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { serializePlanDoc } from '@features/subscription-plans/services/planSerialization'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = await getDb()

  const rawPlans = await db
    .collection('subscriptionPlans')
    .find({ isActive: true })
    .sort({ isDefault: -1, priceMonthly: 1 })
    .toArray()

  const plans = rawPlans.map(p => serializePlanDoc(p as any))

  return NextResponse.json({ plans })
}
