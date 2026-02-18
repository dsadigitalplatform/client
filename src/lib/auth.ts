import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'
import { getSuperAdminEmail } from '@/lib/env'

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

        if (path === '/' || path === '/login') return `${baseUrl}/post-login`
        
return `${baseUrl}${url}`
      }

      try {
        const u = new URL(url)

        if (u.origin === baseUrl) {
          const p = u.pathname

          if (p === '/' || p === '/login') return `${baseUrl}/post-login`
          
return url
        }
      } catch {}

      
return `${baseUrl}/post-login`
    },
    async jwt({ token, account, profile }) {
      if (token.userId) {
        const db = await getDb()

        const userDoc = await db
          .collection('users')
          .findOne({ _id: new ObjectId(token.userId) }, { projection: { isSuperAdmin: 1 } })

        ;(token as any).isSuperAdmin = Boolean((userDoc as any)?.isSuperAdmin)

        const memberships = await db
          .collection('memberships')
          .find({ userId: new ObjectId(token.userId), status: 'active' }, { projection: { tenantId: 1 } })
          .toArray()

        const tenantIds = memberships.map(m => (m.tenantId as ObjectId).toHexString())

        token.tenantIds = tenantIds
        token.currentTenantId = token.currentTenantId || tenantIds[0]

        return token
      }

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

          const userDoc = await db
            .collection('users')
            .findOne({ _id: typeof id === 'string' ? new ObjectId(id) : (id as ObjectId) }, { projection: { isSuperAdmin: 1 } })

          ;(token as any).isSuperAdmin = Boolean((userDoc as any)?.isSuperAdmin)

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
          ;(token as any).isSuperAdmin = Boolean((existingUser as any)?.isSuperAdmin)
        } else {
          let isSuperAdmin = false

          try {
            const superEmail = getSuperAdminEmail()

            if (email && superEmail && String(email).toLowerCase() === superEmail.toLowerCase()) {
              isSuperAdmin = true
            }
          } catch {}

          const insertRes = await users.insertOne({
            email,
            name,
            status: 'active',
            image,
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
            isSuperAdmin
          })

          userIdObj = insertRes.insertedId
          ;(token as any).isSuperAdmin = isSuperAdmin
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

        const memberships = await db
          .collection('memberships')
          .find({ userId: userIdObj, status: 'active' }, { projection: { tenantId: 1 } })
          .toArray()

        const tenantIds = memberships.map(m => (m.tenantId as ObjectId).toHexString())

        token.tenantIds = tenantIds
        token.currentTenantId = tenantIds[0]
      }

      return token
    },
    async session({ session, token }) {
      ;(session as any).userId = token.userId
      ;(session as any).tenantIds = (token as any).tenantIds
      ;(session as any).currentTenantId = (token as any).currentTenantId
      ;(session as any).isSuperAdmin = (token as any).isSuperAdmin

      if (session.user) {
        ;(session.user as any).isSuperAdmin = (token as any).isSuperAdmin
      }

      return session
    }
  }
}
