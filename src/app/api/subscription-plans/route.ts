import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = await getDb()

  const rawPlans = await db
    .collection('subscriptionPlans')
    .find(
      { isActive: true },
      {
        projection: {
          _id: 1,
          name: 1,
          slug: 1,
          description: 1,
          priceMonthly: 1,
          priceYearly: 1,
          currency: 1,
          maxUsers: 1,
          features: 1,
          isActive: 1,
          isDefault: 1
        }
      }
    )
    .sort({ isDefault: -1, priceMonthly: 1 })
    .toArray()

  const plans = rawPlans.map(p => ({ ...p, _id: String(p._id) }))

  
return NextResponse.json({ plans })
}
