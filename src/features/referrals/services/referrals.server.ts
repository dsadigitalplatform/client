import 'server-only'

import { randomBytes } from 'crypto'

import { ObjectId, type Db } from 'mongodb'

import { getSupportRecipientEmails } from '@/lib/env'
import { sendMail } from '@/lib/mailer'
import { isValidMobileDigits, normalizeMobileDigits } from '@/lib/mobile'

import {
  DEFAULT_REFERRAL_SETTINGS,
  type ReferralCredit,
  type ReferralInvite,
  type ReferralInviteStatus,
  type ReferralPayoutDetails,
  type ReferralProgramSettings,
  type ReferralRewardsSummary,
  type ReferralWithdrawal
} from '../referrals.types'
import {
  buildReferralInviteeEmail,
  buildReferralInviteAdminEmail,
  buildReferralWithdrawalAdminEmail,
  buildReferralLink
} from '../emails/referralEmails'

const SETTINGS_ID = 'default'

function toIso(d: unknown): string | null {
  if (d instanceof Date && Number.isFinite(d.getTime())) return d.toISOString()
  if (typeof d === 'string' && d) return d

  return null
}

function oid(id: string | ObjectId): ObjectId {
  return typeof id === 'string' ? new ObjectId(id) : id
}

function serializeSettings(doc: any): ReferralProgramSettings {
  return {
    id: String(doc._id),
    commissionPercent: Number(doc.commissionPercent) || 0,
    headline: String(doc.headline || ''),
    subheadline: String(doc.subheadline || ''),
    benefits: Array.isArray(doc.benefits) ? doc.benefits.map((b: unknown) => String(b)) : [],
    termsHtml: String(doc.termsHtml || ''),
    ctaLabel: String(doc.ctaLabel || 'Invite a DSA'),
    updatedAt: toIso(doc.updatedAt) || new Date().toISOString(),
    updatedByUserId: doc.updatedByUserId ? String(doc.updatedByUserId) : null
  }
}

export function serializeInvite(doc: any, extras?: Partial<ReferralInvite>): ReferralInvite {
  return {
    id: String(doc._id),
    referrerUserId: String(doc.referrerUserId),
    referrerTenantId: String(doc.referrerTenantId),
    inviteeName: doc.inviteeName ? String(doc.inviteeName) : null,
    inviteeEmail: String(doc.inviteeEmail || '').toLowerCase(),
    inviteeMobile: String(doc.inviteeMobile || ''),
    token: String(doc.token),
    status: doc.status as ReferralInviteStatus,
    referredTenantId: doc.referredTenantId ? String(doc.referredTenantId) : null,
    onboardedAt: toIso(doc.onboardedAt),
    subscribedAt: toIso(doc.subscribedAt),
    lastCreditedAt: toIso(doc.lastCreditedAt),
    commissionPercentOverride:
      typeof doc.commissionPercentOverride === 'number' ? doc.commissionPercentOverride : null,
    commissionCancelled: Boolean(doc.commissionCancelled),
    createdAt: toIso(doc.createdAt) || new Date().toISOString(),
    updatedAt: toIso(doc.updatedAt) || new Date().toISOString(),
    ...extras
  }
}

export function serializeCredit(doc: any, extras?: Partial<ReferralCredit>): ReferralCredit {
  return {
    id: String(doc._id),
    referralInviteId: String(doc.referralInviteId),
    referrerUserId: String(doc.referrerUserId),
    referredTenantId: String(doc.referredTenantId),
    sourceInvoiceId: doc.sourceInvoiceId ? String(doc.sourceInvoiceId) : null,
    sourcePaymentNote: doc.sourcePaymentNote ? String(doc.sourcePaymentNote) : null,
    subscriptionAmount: Number(doc.subscriptionAmount) || 0,
    commissionPercent: Number(doc.commissionPercent) || 0,
    commissionAmount: Number(doc.commissionAmount) || 0,
    status: doc.status,
    withdrawalId: doc.withdrawalId ? String(doc.withdrawalId) : null,
    createdAt: toIso(doc.createdAt) || new Date().toISOString(),
    createdByUserId: String(doc.createdByUserId),
    ...extras
  }
}

export function serializeWithdrawal(doc: any, extras?: Partial<ReferralWithdrawal>): ReferralWithdrawal {
  const pd = doc.payoutDetails || {}

  return {
    id: String(doc._id),
    referrerUserId: String(doc.referrerUserId),
    creditIds: Array.isArray(doc.creditIds) ? doc.creditIds.map((id: any) => String(id)) : [],
    amount: Number(doc.amount) || 0,
    payoutDetails: {
      method: pd.method === 'bank' ? 'bank' : 'upi',
      upiId: pd.upiId ?? null,
      accountName: pd.accountName ?? null,
      accountNumber: pd.accountNumber ?? null,
      ifsc: pd.ifsc ?? null
    },
    status: doc.status,
    note: doc.note ? String(doc.note) : null,
    requestedAt: toIso(doc.requestedAt) || new Date().toISOString(),
    resolvedAt: toIso(doc.resolvedAt),
    resolvedByUserId: doc.resolvedByUserId ? String(doc.resolvedByUserId) : null,
    ...extras
  }
}

export async function getOrCreateReferralSettings(db: Db): Promise<ReferralProgramSettings> {
  const col = db.collection('referralProgramSettings')
  let doc = await col.findOne({ _id: SETTINGS_ID as any })

  if (!doc) {
    const now = new Date()

    await col.insertOne({
      _id: SETTINGS_ID as any,
      ...DEFAULT_REFERRAL_SETTINGS,
      updatedAt: now,
      updatedByUserId: null
    })
    doc = await col.findOne({ _id: SETTINGS_ID as any })
  }

  return serializeSettings(doc)
}

export async function updateReferralSettings(
  db: Db,
  actorUserId: string,
  patch: Partial<{
    commissionPercent: number
    headline: string
    subheadline: string
    benefits: string[]
    termsHtml: string
    ctaLabel: string
  }>
): Promise<ReferralProgramSettings> {
  // Ensure singleton exists first — avoid $set / $setOnInsert path conflicts on upsert.
  await getOrCreateReferralSettings(db)

  const set: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedByUserId: oid(actorUserId)
  }

  if (typeof patch.commissionPercent === 'number' && Number.isFinite(patch.commissionPercent)) {
    set.commissionPercent = Math.min(100, Math.max(0, patch.commissionPercent))
  }

  if (typeof patch.headline === 'string') set.headline = patch.headline.trim().slice(0, 200)
  if (typeof patch.subheadline === 'string') set.subheadline = patch.subheadline.trim().slice(0, 500)
  if (typeof patch.termsHtml === 'string') set.termsHtml = patch.termsHtml.slice(0, 20000)
  if (typeof patch.ctaLabel === 'string') set.ctaLabel = patch.ctaLabel.trim().slice(0, 80) || 'Invite a DSA'

  if (Array.isArray(patch.benefits)) {
    set.benefits = patch.benefits.map(b => String(b).trim()).filter(Boolean).slice(0, 12)
  }

  await db.collection('referralProgramSettings').updateOne({ _id: SETTINGS_ID as any }, { $set: set })

  return getOrCreateReferralSettings(db)
}

export async function effectiveCommissionPercent(db: Db, invite: any): Promise<number | null> {
  if (invite.commissionCancelled) return null
  if (typeof invite.commissionPercentOverride === 'number') return invite.commissionPercentOverride
  const settings = await getOrCreateReferralSettings(db)

  return settings.commissionPercent
}

function newToken() {
  return randomBytes(24).toString('hex')
}

export async function createReferralInvite(params: {
  db: Db
  referrerUserId: string
  referrerTenantId: string
  inviteeEmail: string
  inviteeMobile: string
  inviteeName?: string | null
  referrerName?: string | null
  referrerEmail?: string | null
}): Promise<ReferralInvite> {
  const email = params.inviteeEmail.trim().toLowerCase()
  const mobile = normalizeMobileDigits(params.inviteeMobile)

  if (!email.includes('@')) {
    const err: any = new Error('invalid_email')

    err.status = 400
    throw err
  }

  if (!isValidMobileDigits(mobile)) {
    const err: any = new Error('invalid_mobile')

    err.status = 400
    throw err
  }

  const now = new Date()
  const token = newToken()
  const doc = {
    referrerUserId: oid(params.referrerUserId),
    referrerTenantId: oid(params.referrerTenantId),
    inviteeName: params.inviteeName?.trim() || null,
    inviteeEmail: email,
    inviteeMobile: mobile,
    token,
    status: 'invited' as const,
    referredTenantId: null,
    onboardedAt: null,
    subscribedAt: null,
    lastCreditedAt: null,
    commissionPercentOverride: null,
    commissionCancelled: false,
    createdAt: now,
    updatedAt: now
  }

  const result = await params.db.collection('referralInvites').insertOne(doc)
  const settings = await getOrCreateReferralSettings(params.db)
  const link = buildReferralLink(token)

  try {
    const inviteeMail = buildReferralInviteeEmail({
      inviteeName: doc.inviteeName,
      referrerName: params.referrerName || 'A colleague',
      headline: settings.headline,
      commissionPercent: settings.commissionPercent,
      link
    })

    await sendMail({ to: email, subject: inviteeMail.subject, html: inviteeMail.html, text: inviteeMail.text })
  } catch (e) {
    console.error('[referrals] invitee email failed', e)
  }

  try {
    const recipients = getSupportRecipientEmails()
    const adminMail = buildReferralInviteAdminEmail({
      referrerName: params.referrerName || 'Unknown',
      referrerEmail: params.referrerEmail || '',
      inviteeName: doc.inviteeName,
      inviteeEmail: email,
      inviteeMobile: mobile,
      inviteId: result.insertedId.toHexString()
    })

    await Promise.all(
      recipients.map(to => sendMail({ to, subject: adminMail.subject, html: adminMail.html, text: adminMail.text }))
    )
  } catch (e) {
    console.error('[referrals] admin invite notify failed', e)
  }

  return serializeInvite({ ...doc, _id: result.insertedId })
}

export async function listMyReferralInvites(db: Db, referrerUserId: string): Promise<ReferralInvite[]> {
  const docs = await db
    .collection('referralInvites')
    .find({ referrerUserId: oid(referrerUserId) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const tenantIds = docs.map(d => d.referredTenantId).filter(Boolean)
  const tenants =
    tenantIds.length > 0
      ? await db
          .collection('tenants')
          .find({ _id: { $in: tenantIds } }, { projection: { name: 1 } })
          .toArray()
      : []
  const tenantMap = new Map(tenants.map(t => [String(t._id), String(t.name || '')]))
  const settings = await getOrCreateReferralSettings(db)

  return docs.map(d =>
    serializeInvite(d, {
      referredTenantName: d.referredTenantId ? tenantMap.get(String(d.referredTenantId)) || null : null,
      effectiveCommissionPercent: d.commissionCancelled
        ? 0
        : typeof d.commissionPercentOverride === 'number'
          ? d.commissionPercentOverride
          : settings.commissionPercent
    })
  )
}

export async function getMyRewardsSummary(db: Db, referrerUserId: string): Promise<ReferralRewardsSummary> {
  const uid = oid(referrerUserId)
  const [availableAgg, pendingAgg, lifetimeAgg, openInvites, totalReferrals] = await Promise.all([
    db
      .collection('referralCredits')
      .aggregate([{ $match: { referrerUserId: uid, status: 'available' } }, { $group: { _id: null, sum: { $sum: '$commissionAmount' } } }])
      .toArray(),
    db
      .collection('referralCredits')
      .aggregate([{ $match: { referrerUserId: uid, status: 'locked' } }, { $group: { _id: null, sum: { $sum: '$commissionAmount' } } }])
      .toArray(),
    db
      .collection('referralCredits')
      .aggregate([
        { $match: { referrerUserId: uid, status: { $in: ['available', 'locked', 'withdrawn'] } } },
        { $group: { _id: null, sum: { $sum: '$commissionAmount' } } }
      ])
      .toArray(),
    db.collection('referralInvites').countDocuments({ referrerUserId: uid, status: 'invited' }),
    db.collection('referralInvites').countDocuments({ referrerUserId: uid })
  ])

  return {
    availableBalance: Number(availableAgg[0]?.sum) || 0,
    pendingWithdrawal: Number(pendingAgg[0]?.sum) || 0,
    lifetimeEarned: Number(lifetimeAgg[0]?.sum) || 0,
    openInvites,
    totalReferrals
  }
}

export async function listMyCredits(db: Db, referrerUserId: string): Promise<ReferralCredit[]> {
  const docs = await db
    .collection('referralCredits')
    .find({ referrerUserId: oid(referrerUserId) })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const tenantIds = [...new Set(docs.map(d => String(d.referredTenantId)))]
  const tenants = await db
    .collection('tenants')
    .find({ _id: { $in: tenantIds.map(id => oid(id)) } }, { projection: { name: 1 } })
    .toArray()
  const map = new Map(tenants.map(t => [String(t._id), String(t.name || '')]))

  return docs.map(d => serializeCredit(d, { referredTenantName: map.get(String(d.referredTenantId)) || null }))
}

export async function listMyWithdrawals(db: Db, referrerUserId: string): Promise<ReferralWithdrawal[]> {
  const docs = await db
    .collection('referralWithdrawals')
    .find({ referrerUserId: oid(referrerUserId) })
    .sort({ requestedAt: -1 })
    .limit(100)
    .toArray()

  return docs.map(d => serializeWithdrawal(d))
}

export async function requestWithdrawal(params: {
  db: Db
  referrerUserId: string
  creditIds: string[]
  payoutDetails: ReferralPayoutDetails
  referrerName?: string | null
  referrerEmail?: string | null
}): Promise<ReferralWithdrawal> {
  const uid = oid(params.referrerUserId)
  const ids = params.creditIds.filter(id => ObjectId.isValid(id)).map(id => oid(id))

  if (ids.length === 0) {
    const err: any = new Error('no_credits')

    err.status = 400
    throw err
  }

  const pd = params.payoutDetails

  if (pd.method === 'upi' && !(pd.upiId && String(pd.upiId).trim())) {
    const err: any = new Error('invalid_payout')

    err.status = 400
    throw err
  }

  if (
    pd.method === 'bank' &&
    !(pd.accountName && pd.accountNumber && pd.ifsc && String(pd.accountName).trim() && String(pd.accountNumber).trim())
  ) {
    const err: any = new Error('invalid_payout')

    err.status = 400
    throw err
  }

  const credits = await params.db
    .collection('referralCredits')
    .find({ _id: { $in: ids }, referrerUserId: uid, status: 'available' })
    .toArray()

  if (credits.length !== ids.length) {
    const err: any = new Error('credits_unavailable')

    err.status = 400
    throw err
  }

  const amount = credits.reduce((s, c) => s + (Number(c.commissionAmount) || 0), 0)
  const now = new Date()
  const insert = await params.db.collection('referralWithdrawals').insertOne({
    referrerUserId: uid,
    creditIds: ids,
    amount,
    payoutDetails: {
      method: pd.method,
      upiId: pd.method === 'upi' ? String(pd.upiId).trim() : null,
      accountName: pd.method === 'bank' ? String(pd.accountName).trim() : null,
      accountNumber: pd.method === 'bank' ? String(pd.accountNumber).trim() : null,
      ifsc: pd.method === 'bank' ? String(pd.ifsc).trim().toUpperCase() : null
    },
    status: 'requested',
    note: null,
    requestedAt: now,
    resolvedAt: null,
    resolvedByUserId: null
  })

  await params.db.collection('referralCredits').updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'locked', withdrawalId: insert.insertedId } }
  )

  try {
    const recipients = getSupportRecipientEmails()
    const mail = buildReferralWithdrawalAdminEmail({
      referrerName: params.referrerName || 'Unknown',
      referrerEmail: params.referrerEmail || '',
      amount,
      creditCount: credits.length,
      payoutDetails: pd,
      withdrawalId: insert.insertedId.toHexString()
    })

    await Promise.all(recipients.map(to => sendMail({ to, subject: mail.subject, html: mail.html, text: mail.text })))
  } catch (e) {
    console.error('[referrals] withdrawal admin email failed', e)
  }

  const doc = await params.db.collection('referralWithdrawals').findOne({ _id: insert.insertedId })

  return serializeWithdrawal(doc)
}

/** Link a referred tenant to a referrer (from invite or manual). */
export async function linkReferralAttribution(params: {
  db: Db
  referredTenantId: string
  referrerUserId: string
  referralInviteId?: string | null
  inviteeEmail?: string | null
  inviteeMobile?: string | null
  inviteeName?: string | null
  actorTenantId?: string | null
}): Promise<ReferralInvite> {
  const db = params.db
  const tenantId = oid(params.referredTenantId)
  const referrerUserId = oid(params.referrerUserId)
  const now = new Date()

  const existing = await db.collection('referralInvites').findOne({
    referredTenantId: tenantId,
    status: { $ne: 'cancelled' }
  })

  if (existing && String(existing._id) !== String(params.referralInviteId || '')) {
    const err: any = new Error('tenant_already_attributed')

    err.status = 409
    throw err
  }

  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  let status: ReferralInviteStatus = 'onboarded'
  const setExtra: Record<string, unknown> = {
    referredTenantId: tenantId,
    referrerUserId,
    onboardedAt: now,
    updatedAt: now,
    commissionCancelled: false
  }

  if (sub) {
    status = 'subscribed'
    setExtra.subscribedAt = now
  }

  setExtra.status = status

  if (params.referralInviteId && ObjectId.isValid(params.referralInviteId)) {
    const inviteId = oid(params.referralInviteId)
    const res = await db.collection('referralInvites').findOneAndUpdate(
      { _id: inviteId },
      { $set: setExtra },
      { returnDocument: 'after' }
    )
    const doc = (res as any)?.value ?? res

    if (!doc) {
      const err: any = new Error('invite_not_found')

      err.status = 404
      throw err
    }

    return serializeInvite(doc)
  }

  // Match open invite by email/mobile for this referrer
  const email = params.inviteeEmail?.trim().toLowerCase()
  const mobile = params.inviteeMobile ? normalizeMobileDigits(params.inviteeMobile) : null

  let openInvite =
    email || mobile
      ? await db.collection('referralInvites').findOne({
          referrerUserId,
          status: 'invited',
          $or: [...(email ? [{ inviteeEmail: email }] : []), ...(mobile ? [{ inviteeMobile: mobile }] : [])]
        })
      : null

  if (!openInvite && (email || mobile)) {
    openInvite = await db.collection('referralInvites').findOne({
      status: 'invited',
      $or: [...(email ? [{ inviteeEmail: email }] : []), ...(mobile ? [{ inviteeMobile: mobile }] : [])]
    })
  }

  if (openInvite) {
    const res = await db.collection('referralInvites').findOneAndUpdate(
      { _id: openInvite._id },
      { $set: { ...setExtra, referrerUserId } },
      { returnDocument: 'after' }
    )

    return serializeInvite((res as any)?.value ?? res)
  }

  // Manual attribution without prior invite
  const membership = await db.collection('memberships').findOne({
    userId: referrerUserId,
    status: 'active'
  })
  const referrerTenantId = membership?.tenantId || (params.actorTenantId ? oid(params.actorTenantId) : null)

  if (!referrerTenantId) {
    const err: any = new Error('referrer_no_tenant')

    err.status = 400
    throw err
  }

  const insert = await db.collection('referralInvites').insertOne({
    referrerUserId,
    referrerTenantId,
    inviteeName: params.inviteeName?.trim() || null,
    inviteeEmail: email || `linked+${tenantId.toHexString()}@referral.local`,
    inviteeMobile: mobile || '00000000',
    token: newToken(),
    status,
    referredTenantId: tenantId,
    onboardedAt: now,
    subscribedAt: sub ? now : null,
    lastCreditedAt: null,
    commissionPercentOverride: null,
    commissionCancelled: false,
    createdAt: now,
    updatedAt: now
  })

  const doc = await db.collection('referralInvites').findOne({ _id: insert.insertedId })

  return serializeInvite(doc)
}

export async function updateInviteCommission(params: {
  db: Db
  inviteId: string
  commissionPercentOverride?: number | null
  commissionCancelled?: boolean
}): Promise<ReferralInvite> {
  const set: Record<string, unknown> = { updatedAt: new Date() }

  if (params.commissionCancelled === true) {
    set.commissionCancelled = true
  } else if (params.commissionCancelled === false) {
    set.commissionCancelled = false
  }

  if (params.commissionPercentOverride === null) {
    set.commissionPercentOverride = null
  } else if (typeof params.commissionPercentOverride === 'number') {
    set.commissionPercentOverride = Math.min(100, Math.max(0, params.commissionPercentOverride))
  }

  const res = await params.db.collection('referralInvites').findOneAndUpdate(
    { _id: oid(params.inviteId) },
    { $set: set },
    { returnDocument: 'after' }
  )
  const doc = (res as any)?.value ?? res

  if (!doc) {
    const err: any = new Error('invite_not_found')

    err.status = 404
    throw err
  }

  return serializeInvite(doc)
}

export async function createReferralCreditFromPayment(params: {
  db: Db
  referredTenantId: string
  actorUserId: string
  subscriptionAmountRupees: number
  sourceInvoiceId?: string | null
  sourcePaymentNote?: string | null
  skip?: boolean
}): Promise<ReferralCredit | null> {
  if (params.skip) return null

  const invite = await params.db.collection('referralInvites').findOne({
    referredTenantId: oid(params.referredTenantId),
    status: { $in: ['onboarded', 'subscribed', 'paid'] },
    commissionCancelled: { $ne: true }
  })

  if (!invite) return null

  const percent = await effectiveCommissionPercent(params.db, invite)

  if (percent == null || percent <= 0) return null

  const amount = Math.max(0, Number(params.subscriptionAmountRupees) || 0)
  const commissionAmount = Math.round(((amount * percent) / 100) * 100) / 100
  const now = new Date()

  const insert = await params.db.collection('referralCredits').insertOne({
    referralInviteId: invite._id,
    referrerUserId: invite.referrerUserId,
    referredTenantId: oid(params.referredTenantId),
    sourceInvoiceId: params.sourceInvoiceId ? oid(params.sourceInvoiceId) : null,
    sourcePaymentNote: params.sourcePaymentNote || null,
    subscriptionAmount: amount,
    commissionPercent: percent,
    commissionAmount,
    status: 'available',
    withdrawalId: null,
    createdAt: now,
    createdByUserId: oid(params.actorUserId)
  })

  await params.db.collection('referralInvites').updateOne(
    { _id: invite._id },
    {
      $set: {
        status: 'paid',
        lastCreditedAt: now,
        updatedAt: now,
        ...(invite.status === 'onboarded' || invite.status === 'subscribed' ? {} : {})
      }
    }
  )

  // Ensure subscribedAt if missing
  if (!invite.subscribedAt) {
    await params.db.collection('referralInvites').updateOne({ _id: invite._id }, { $set: { subscribedAt: now } })
  }

  const doc = await params.db.collection('referralCredits').findOne({ _id: insert.insertedId })

  return serializeCredit(doc)
}

export async function adminListInvites(
  db: Db,
  opts?: { status?: string; q?: string; limit?: number }
): Promise<ReferralInvite[]> {
  const filter: Record<string, unknown> = {}

  if (opts?.status && opts.status !== 'all') filter.status = opts.status

  if (opts?.q?.trim()) {
    const q = opts.q.trim()
    const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }

    filter.$or = [{ inviteeEmail: rx }, { inviteeMobile: rx }, { inviteeName: rx }]
  }

  const docs = await db
    .collection('referralInvites')
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(opts?.limit || 100)
    .toArray()

  const userIds = [...new Set(docs.map(d => String(d.referrerUserId)))]
  const tenantIds = [...new Set(docs.map(d => (d.referredTenantId ? String(d.referredTenantId) : null)).filter(Boolean))] as string[]

  const [users, tenants, settings] = await Promise.all([
    db
      .collection('users')
      .find({ _id: { $in: userIds.map(id => oid(id)) } }, { projection: { name: 1, email: 1 } })
      .toArray(),
    tenantIds.length
      ? db
          .collection('tenants')
          .find({ _id: { $in: tenantIds.map(id => oid(id)) } }, { projection: { name: 1 } })
          .toArray()
      : Promise.resolve([]),
    getOrCreateReferralSettings(db)
  ])

  const userMap = new Map(users.map(u => [String(u._id), u]))
  const tenantMap = new Map(tenants.map(t => [String(t._id), String(t.name || '')]))

  return docs.map(d => {
    const u = userMap.get(String(d.referrerUserId))

    return serializeInvite(d, {
      referrerName: u?.name ? String(u.name) : null,
      referrerEmail: u?.email ? String(u.email) : null,
      referredTenantName: d.referredTenantId ? tenantMap.get(String(d.referredTenantId)) || null : null,
      effectiveCommissionPercent: d.commissionCancelled
        ? 0
        : typeof d.commissionPercentOverride === 'number'
          ? d.commissionPercentOverride
          : settings.commissionPercent
    })
  })
}

export async function adminListCredits(db: Db, limit = 100): Promise<ReferralCredit[]> {
  const docs = await db.collection('referralCredits').find({}).sort({ createdAt: -1 }).limit(limit).toArray()
  const tenantIds = [...new Set(docs.map(d => String(d.referredTenantId)))]
  const tenants = await db
    .collection('tenants')
    .find({ _id: { $in: tenantIds.map(id => oid(id)) } }, { projection: { name: 1 } })
    .toArray()
  const map = new Map(tenants.map(t => [String(t._id), String(t.name || '')]))

  return docs.map(d => serializeCredit(d, { referredTenantName: map.get(String(d.referredTenantId)) || null }))
}

export async function adminListWithdrawals(db: Db, status?: string): Promise<ReferralWithdrawal[]> {
  const filter: Record<string, unknown> = {}

  if (status && status !== 'all') filter.status = status

  const docs = await db.collection('referralWithdrawals').find(filter).sort({ requestedAt: -1 }).limit(100).toArray()
  const userIds = [...new Set(docs.map(d => String(d.referrerUserId)))]
  const users = await db
    .collection('users')
    .find({ _id: { $in: userIds.map(id => oid(id)) } }, { projection: { name: 1, email: 1 } })
    .toArray()
  const map = new Map(users.map(u => [String(u._id), u]))

  return docs.map(d => {
    const u = map.get(String(d.referrerUserId))

    return serializeWithdrawal(d, {
      referrerName: u?.name ? String(u.name) : null,
      referrerEmail: u?.email ? String(u.email) : null
    })
  })
}

export async function resolveWithdrawal(params: {
  db: Db
  withdrawalId: string
  actorUserId: string
  action: 'paid' | 'rejected'
  note?: string | null
}): Promise<ReferralWithdrawal> {
  const w = await params.db.collection('referralWithdrawals').findOne({ _id: oid(params.withdrawalId) })

  if (!w || w.status !== 'requested') {
    const err: any = new Error('withdrawal_not_found')

    err.status = 404
    throw err
  }

  const now = new Date()

  if (params.action === 'paid') {
    await params.db.collection('referralWithdrawals').updateOne(
      { _id: w._id },
      {
        $set: {
          status: 'paid',
          resolvedAt: now,
          resolvedByUserId: oid(params.actorUserId),
          note: params.note?.trim() || null
        }
      }
    )
    await params.db.collection('referralCredits').updateMany(
      { _id: { $in: w.creditIds } },
      { $set: { status: 'withdrawn' } }
    )
  } else {
    await params.db.collection('referralWithdrawals').updateOne(
      { _id: w._id },
      {
        $set: {
          status: 'rejected',
          resolvedAt: now,
          resolvedByUserId: oid(params.actorUserId),
          note: params.note?.trim() || null
        }
      }
    )
    await params.db.collection('referralCredits').updateMany(
      { _id: { $in: w.creditIds }, status: 'locked' },
      { $set: { status: 'available', withdrawalId: null } }
    )
  }

  const doc = await params.db.collection('referralWithdrawals').findOne({ _id: w._id })

  return serializeWithdrawal(doc)
}

export async function voidCredit(db: Db, creditId: string): Promise<ReferralCredit> {
  const res = await db.collection('referralCredits').findOneAndUpdate(
    { _id: oid(creditId), status: 'available' },
    { $set: { status: 'void' } },
    { returnDocument: 'after' }
  )
  const doc = (res as any)?.value ?? res

  if (!doc) {
    const err: any = new Error('credit_not_found')

    err.status = 404
    throw err
  }

  return serializeCredit(doc)
}

export async function markInviteSubscribedIfNeeded(db: Db, tenantId: string) {
  await db.collection('referralInvites').updateOne(
    {
      referredTenantId: oid(tenantId),
      status: 'onboarded'
    },
    { $set: { status: 'subscribed', subscribedAt: new Date(), updatedAt: new Date() } }
  )
}
