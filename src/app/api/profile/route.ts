export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isValidName(v: unknown) {
  return typeof v === 'string' && v.trim().length >= 2
}

function isValidCountryCode(v: unknown) {
  return typeof v === 'string' && /^\+[0-9]{1,4}$/.test(v)
}

function isValidMobile(v: unknown) {
  return typeof v === 'string' && /^[0-9]{9,10}$/.test(v)
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ObjectId.isValid(session.userId)) return NextResponse.json({ error: 'invalid_user' }, { status: 400 })

  const db = await getDb()
  const userIdObj = new ObjectId(session.userId)

  const userDoc = await db.collection('users').findOne(
    { _id: userIdObj },
    { projection: { name: 1, email: 1, image: 1, countryCode: 1, mobile: 1, notifyMe: 1 } }
  )

  if (!userDoc) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const profile = {
    id: userIdObj.toHexString(),
    name: String((userDoc as any)?.name || session.user?.name || ''),
    email: String((userDoc as any)?.email || session.user?.email || ''),
    image: (userDoc as any)?.image ?? session.user?.image ?? null,
    countryCode: (userDoc as any)?.countryCode ?? null,
    mobile: (userDoc as any)?.mobile ?? null,
    notifyMe: Boolean((userDoc as any)?.notifyMe)
  }

  return NextResponse.json({ profile })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!ObjectId.isValid(session.userId)) return NextResponse.json({ error: 'invalid_user' }, { status: 400 })

  const body = await request.json().catch(() => ({}))
  const name = body?.name == null ? '' : String(body.name)
  const image = body?.image == null ? null : String(body.image)
  const countryCode = body?.countryCode == null ? null : String(body.countryCode)
  const mobile = body?.mobile == null ? null : String(body.mobile)
  const notifyMe = body?.notifyMe === true

  const errors: Record<string, string> = {}

  if (!isValidName(name)) errors.name = 'Name must be at least 2 characters'
  if (countryCode && !isValidCountryCode(countryCode)) errors.countryCode = 'Invalid country code'
  if (mobile && !isValidMobile(mobile)) errors.mobile = 'Mobile must be 9 or 10 digits'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ message: 'Validation failed', details: errors }, { status: 400 })
  }

  const db = await getDb()
  const userIdObj = new ObjectId(session.userId)
  const now = new Date()

  await db.collection('users').updateOne(
    { _id: userIdObj },
    {
      $set: {
        name: name.trim(),
        image: image && image.trim().length > 0 ? image.trim() : null,
        countryCode: countryCode && countryCode.trim().length > 0 ? countryCode.trim() : null,
        mobile: mobile && mobile.trim().length > 0 ? mobile.trim() : null,
        notifyMe,
        updatedAt: now
      }
    }
  )

  const profile = {
    id: userIdObj.toHexString(),
    name: name.trim(),
    email: String(session.user?.email || ''),
    image: image && image.trim().length > 0 ? image.trim() : null,
    countryCode: countryCode && countryCode.trim().length > 0 ? countryCode.trim() : null,
    mobile: mobile && mobile.trim().length > 0 ? mobile.trim() : null,
    notifyMe
  }

  return NextResponse.json({ profile })
}
