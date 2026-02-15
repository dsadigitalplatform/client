import 'server-only'
import { type NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    })
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV !== 'production',
  callbacks: {
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) {
        const path = url.split('?')[0]
        if (path === '/' || path === '/login') return `${baseUrl}/home`
        return `${baseUrl}${url}`
      }
      try {
        const u = new URL(url)
        if (u.origin === baseUrl) return url
      } catch {}
      return `${baseUrl}/home`
    },
    async jwt({ token, account }) {
      if (account?.provider === 'google') {
        token.userId = account.providerAccountId
      }

      return token
    },
    async session({ session, token }) {
      ;(session as any).userId = token.userId

      return session
    }
  }
}
