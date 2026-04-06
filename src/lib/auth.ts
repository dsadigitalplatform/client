import 'server-only'
import type { NextAuthOptions } from 'next-auth'
import Google from 'next-auth/providers/google'
import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'
import { getSuperAdminEmail } from '@/lib/env'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

type HydratedUserState = {
  isSuperAdmin: boolean
  tenantIds: string[]
  currentTenantId?: string
  email?: string
  name?: string
  image?: string
}

type TokenImpersonation = {
  active: boolean
  actorUserId: string
  targetUserId: string
  startedAt: string
  reason?: string
  auditId?: string
}

async function hydrateUserState(
  db: Awaited<ReturnType<typeof getDb>>,
  userId: string,
  preferredTenantId?: string
): Promise<HydratedUserState> {
  const userDoc = await db
    .collection('users')
    .findOne({ _id: new ObjectId(userId) }, { projection: { isSuperAdmin: 1, email: 1, name: 1, image: 1 } })

  const email = String((userDoc as any)?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId: new ObjectId(userId) }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const memberships = await db
    .collection('memberships')
    .find({ status: 'active', $or: orFilters }, { projection: { tenantId: 1 } })
    .toArray()

  const tenantIds = memberships.map(m => (m.tenantId as ObjectId).toHexString())

  const currentTenantId =
    preferredTenantId && tenantIds.includes(preferredTenantId) ? preferredTenantId : tenantIds[0]

  return {
    isSuperAdmin: Boolean((userDoc as any)?.isSuperAdmin),
    tenantIds,
    currentTenantId,
    email: (userDoc as any)?.email ?? undefined,
    name: (userDoc as any)?.name ?? undefined,
    image: (userDoc as any)?.image ?? undefined
  }
}

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
    async jwt({ token, account, profile, trigger, session }) {
      if (trigger === 'update') {
        if ((session as any)?.currentTenantId) {
          ;(token as any).currentTenantId = (session as any).currentTenantId
        }

        const impersonationStartNonce = String((session as any)?.impersonationStartNonce || '')
        const shouldStopImpersonation = Boolean((session as any)?.impersonationStop)

        if (impersonationStartNonce && token.userId && !(token as any)?.impersonation?.active) {
          const db = await getDb()
          const actorUserId = String(token.userId)

          const actorDoc = await db
            .collection('users')
            .findOne({ _id: new ObjectId(actorUserId) }, { projection: { isSuperAdmin: 1 } })

          if (!Boolean((actorDoc as any)?.isSuperAdmin)) return token

          const nonceDoc = await db.collection('impersonationNonces').findOneAndUpdate(
            {
              nonce: impersonationStartNonce,
              actorUserId: new ObjectId(actorUserId),
              usedAt: null,
              expiresAt: { $gt: new Date() }
            },
            { $set: { usedAt: new Date(), updatedAt: new Date() } },
            { returnDocument: 'after' }
          )

          const nonceValue: any = (nonceDoc as any)?.value ?? nonceDoc ?? null

          if (!nonceValue?.targetUserId) return token

          const targetUserId =
            typeof nonceValue.targetUserId?.toHexString === 'function'
              ? nonceValue.targetUserId.toHexString()
              : String(nonceValue.targetUserId)

          const preferredTenantIdRaw =
            typeof nonceValue.tenantId?.toHexString === 'function'
              ? nonceValue.tenantId.toHexString()
              : String(nonceValue.tenantId || '')

          const preferredTenantId = preferredTenantIdRaw && ObjectId.isValid(preferredTenantIdRaw) ? preferredTenantIdRaw : undefined

          const targetState = await hydrateUserState(db, targetUserId, preferredTenantId)

          token.userId = targetUserId
          ;(token as any).isSuperAdmin = targetState.isSuperAdmin
          token.tenantIds = targetState.tenantIds
          token.currentTenantId = targetState.currentTenantId
          ;(token as any).email = targetState.email
          ;(token as any).name = targetState.name
          ;(token as any).picture = targetState.image
          ;(token as any).impersonation = {
            active: true,
            actorUserId,
            targetUserId,
            startedAt: new Date().toISOString(),
            reason: String(nonceValue.reason || '') || undefined,
            auditId:
              typeof nonceValue.auditId?.toHexString === 'function'
                ? nonceValue.auditId.toHexString()
                : String(nonceValue.auditId || '') || undefined
          } as TokenImpersonation

          if (nonceValue.auditId) {
            await db.collection('impersonationAudits').updateOne(
              { _id: nonceValue.auditId },
              {
                $set: {
                  status: 'active',
                  startedAt: new Date(),
                  updatedAt: new Date()
                }
              }
            )
          }

          return token
        }

        if (shouldStopImpersonation && (token as any)?.impersonation?.active) {
          const db = await getDb()
          const activeImpersonation = (token as any).impersonation as TokenImpersonation
          const actorUserId = String(activeImpersonation.actorUserId || '')

          if (!actorUserId || !ObjectId.isValid(actorUserId)) return token
          const actorState = await hydrateUserState(db, actorUserId)

          token.userId = actorUserId
          ;(token as any).isSuperAdmin = actorState.isSuperAdmin
          token.tenantIds = actorState.tenantIds
          token.currentTenantId = actorState.currentTenantId
          ;(token as any).email = actorState.email
          ;(token as any).name = actorState.name
          ;(token as any).picture = actorState.image
          ;(token as any).impersonation = undefined

          if (activeImpersonation.auditId && ObjectId.isValid(activeImpersonation.auditId)) {
            await db.collection('impersonationAudits').updateOne(
              { _id: new ObjectId(activeImpersonation.auditId) },
              {
                $set: {
                  status: 'ended',
                  endedAt: new Date(),
                  updatedAt: new Date()
                }
              }
            )
          }

          return token
        }

        return token
      }

      if (token.userId) {
        const db = await getDb()

        const state = await hydrateUserState(db, String(token.userId), token.currentTenantId)

        ;(token as any).isSuperAdmin = state.isSuperAdmin
        token.tenantIds = state.tenantIds
        token.currentTenantId = state.currentTenantId
        ;(token as any).email = state.email
        ;(token as any).name = state.name
        ;(token as any).picture = state.image

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
      ;(session as any).impersonation = (token as any).impersonation

      if (session.user) {
        ;(session.user as any).isSuperAdmin = (token as any).isSuperAdmin
      }

      if ((session as any).userId && !(session as any).currentTenantId) {
        const db = await getDb()
        const userIdObj = new ObjectId((session as any).userId)

        const email = String((session as any)?.user?.email || '')

        const emailFilter =
          email && email.length > 0
            ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } }
            : undefined

        const orFilters = [{ userId: userIdObj }] as any[]

        if (emailFilter) orFilters.push(emailFilter)

        const memberships = await db
          .collection('memberships')
          .find({ status: 'active', $or: orFilters }, { projection: { tenantId: 1 } })
          .toArray()

        const tenantIds = memberships.map(m => (m.tenantId as ObjectId).toHexString())

        if (tenantIds.length > 0) {
          ;(session as any).tenantIds = tenantIds
          ;(session as any).currentTenantId = tenantIds[0]
        }
      }

      return session
    }
  }
}
