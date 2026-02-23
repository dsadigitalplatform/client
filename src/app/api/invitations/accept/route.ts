export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

import { acceptInvitation } from '@features/invitations'

type Payload = {
  token: string
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const sessionUserId = (session as any)?.userId as string | undefined
    const sessionEmail = (session as any)?.user?.email as string | undefined

    if (!sessionUserId || !sessionEmail) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    let body: Partial<Payload>

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
    }

    const token = typeof body?.token === 'string' ? body.token.trim() : ''

    if (!token) {
      return NextResponse.json({ error: 'token_required' }, { status: 400 })
    }

    const result = await acceptInvitation({ token, sessionUserId, sessionEmail })

    const res = NextResponse.json({ success: true, tenantId: result.tenantId })


    // Set CURRENT_TENANT_ID on the response so the browser stores it immediately
    res.cookies.set('CURRENT_TENANT_ID', result.tenantId, {
      path: '/',
      httpOnly: true
    })
    
return res
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500

    const error =
      status === 403
        ? 'email_mismatch'
        : status === 400
        ? 'invalid_token'
        : status === 409
        ? 'already_accepted'
        : 'internal_error'

    
return NextResponse.json({ error }, { status })
  }
}
