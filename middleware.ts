import type { NextRequest } from 'next/server'

import { NextResponse } from 'next/server'
 
export function middleware(req: NextRequest) {
  const { nextUrl } = req
  const pathname = nextUrl.pathname

  const isLogin = pathname.startsWith('/login')

  const isAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.startsWith('/api')

  if (!isLogin && !isAsset) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  return NextResponse.next()
}
 
 export const config = {
  matcher: ['/((?!api|_next|favicon|assets).*)']
 }
