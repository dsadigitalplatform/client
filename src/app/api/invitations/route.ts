import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { createInvitation } from '@features/invitations'
import { sendInvitationEmail } from '@/lib/mailer'

type Payload = {
  email: string
  role: 'ADMIN' | 'USER'
  tenantId: string
}

function isEmail(v: unknown): v is string {
  return typeof v === 'string' && v.includes('@')
}

function isRole(v: unknown): v is 'ADMIN' | 'USER' {
  return v === 'ADMIN' || v === 'USER'
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const requesterUserId = (session as any)?.userId as string | undefined

    if (!requesterUserId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as Partial<Payload>
    const { email, role, tenantId } = body

    if (!isEmail(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 })
    }

    if (!isRole(role)) {
      return NextResponse.json({ error: 'invalid_role' }, { status: 400 })
    }

    if (typeof tenantId !== 'string' || !ObjectId.isValid(tenantId)) {
      return NextResponse.json({ error: 'invalid_tenantId' }, { status: 400 })
    }

    const result = await createInvitation({
      requesterUserId,
      tenantId,
      email,
      role
    })

    await sendInvitationEmail(email, result.tenantName, result.token)

    return NextResponse.json({
      success: true,
      message: 'Invitation sent'
    })
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500
    const message = status === 403 ? 'forbidden' : 'internal_error'

    
return NextResponse.json({ error: message }, { status })
  }
}
