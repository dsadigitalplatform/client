import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { createTenant } from '@features/tenants'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const type = body?.type === 'sole_trader' || body?.type === 'company' ? body.type : undefined
  if (!name || !type) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

  const result = await createTenant({ name, type, createdById: session.userId! })

  return NextResponse.json(result, { status: 201 })
}
