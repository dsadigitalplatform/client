import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname
  const isLogin = pathname.startsWith('/login')
  const isAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api')

  if (isAsset) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (isLogin && token) {
    return NextResponse.redirect(new URL('/post-login', nextUrl))
  }

  if (!isLogin && !token) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next|favicon|assets).*)']
}
