import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getToken } from 'next-auth/jwt'

function getDemoTenantIdFromEnv(): string | null {
  const raw = process.env.DEMO_TENANT_ID?.trim()

  if (!raw || raw.length !== 24) return null

  return raw
}

function withDemoTenantCookie(res: NextResponse, demoTenantId: string) {
  res.cookies.set('CURRENT_TENANT_ID', demoTenantId, { path: '/', httpOnly: true })

  return res
}

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname
  const isLogin = pathname.startsWith('/login')
  const isAuthApi = pathname.startsWith('/api/auth')
  const isApi = pathname.startsWith('/api')

  const isStaticAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/images')

  if (isStaticAsset) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  const demoEnabled = process.env.ENABLE_DEMO_LOGIN === 'true'
  const demoTenantId = demoEnabled ? getDemoTenantIdFromEnv() : null
  const isDemoSession = Boolean((token as any)?.isDemoMode) && Boolean(demoTenantId)

  if (isApi && !isAuthApi) {
    if (!token) return NextResponse.next()

    if (isDemoSession && demoTenantId) {
      return withDemoTenantCookie(NextResponse.next(), demoTenantId)
    }

    return NextResponse.next()
  }

  if (isApi) return NextResponse.next()

  if (isLogin && token) {
    const res = NextResponse.redirect(new URL('/post-login', nextUrl))

    if (isDemoSession && demoTenantId) {
      return withDemoTenantCookie(res, demoTenantId)
    }

    return res
  }

  if (!isLogin && !token) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  if (isDemoSession && demoTenantId) {
    return withDemoTenantCookie(NextResponse.next(), demoTenantId)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next|favicon|assets|images).*)']
}
