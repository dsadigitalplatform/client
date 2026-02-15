import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'

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
    async jwt({ token, account, profile }) {
      if (token.userId) return token
      if (account?.provider === 'google') {
        const db = await getDb()
        const provider = 'google'
        const providerUserId = account.providerAccountId
        const now = new Date()
        const authAccounts = db.collection('authAccounts')
        const existingAuth = await authAccounts.findOne({ provider, providerUserId })
        if (existingAuth) {
          await authAccounts.updateOne({ _id: existingAuth._id }, { $set: { lastLoginAt: now, updatedAt: now } })
          const id = (existingAuth as any).userId
          token.userId = typeof id === 'string' ? id : (id as ObjectId).toHexString()

          return token
        }
        const users = db.collection('users')
        const email =
          (profile as any)?.email || (account as any)?.email || (token as any)?.email || undefined
        const name =
          (profile as any)?.name ||
          (token as any)?.name ||
          (email ? String(email).split('@')[0] : 'User')
        const image = (profile as any)?.picture || (token as any)?.picture || undefined
        let userIdObj: ObjectId
        const existingUser = email ? await users.findOne({ email }) : null
        if (existingUser) {
          userIdObj = (existingUser as any)._id as ObjectId
          await users.updateOne({ _id: userIdObj }, { $set: { lastLoginAt: now, updatedAt: now } })
        } else {
          const insertRes = await users.insertOne({
            email,
            name,
            status: 'active',
            image,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
            isSuperAdmin: false
          })
          userIdObj = insertRes.insertedId
        }
        await authAccounts.insertOne({
          userId: userIdObj,
          provider,
          providerUserId,
           email,
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now
        })
        token.userId = userIdObj.toHexString()
      }

      return token
    },
    async session({ session, token }) {
      ;(session as any).userId = token.userId

      return session
    }
  }
}
