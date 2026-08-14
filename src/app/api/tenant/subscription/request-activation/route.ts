export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getSupportRecipientEmails } from '@/lib/env'
import { sendMail } from '@/lib/mailer'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { getCurrentTenantSubscriptionDoc } from '@features/subscriptions/services/entitlements.server'
import { ensureEligibleDiscountOnSubscription } from '@features/subscriptions/services/discountCodes.server'
import { buildSubscriptionPricing, planPriceForInterval } from '@features/subscriptions/services/discountPricing'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function row(label: string, value: string) {
  return `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>${escapeHtml(label)}</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${value}</td></tr>`
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 1000) : ''

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const actorUserId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId: actorUserId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db.collection('memberships').findOne(
    { tenantId, status: 'active', $or: orFilters },
    { projection: { role: 1 } }
  )

  const role = (membership?.role as string | undefined) || null
  const sub = await getCurrentTenantSubscriptionDoc(db, tenantId)

  const isOwner = role === 'OWNER' || isSuperAdmin
  const isBillingContact =
    Boolean(sub?.billingContactUserId) && String(sub?.billingContactUserId) === String(actorUserId)

  if (!isOwner && !isBillingContact) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (!sub) {
    return NextResponse.json({ error: 'no_subscription', message: 'No subscription found to activate' }, { status: 400 })
  }

  let recipients: string[] = []

  try {
    recipients = getSupportRecipientEmails()
  } catch {
    recipients = []
  }

  const dbSuperAdmins = await db
    .collection('users')
    .find({ isSuperAdmin: true }, { projection: { email: 1 } })
    .toArray()

  for (const u of dbSuperAdmins) {
    if (typeof u.email === 'string' && u.email.trim()) recipients.push(u.email.trim())
  }

  const recipientMap = new Map<string, string>()

  for (const raw of recipients) {
    const trimmed = raw.trim()

    if (trimmed) recipientMap.set(trimmed.toLowerCase(), trimmed)
  }

  recipients = Array.from(recipientMap.values())

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'support_recipients_not_configured' }, { status: 500 })
  }

  const tenant = await db.collection('tenants').findOne({ _id: tenantId })
  const plan = sub.planId ? await db.collection('subscriptionPlans').findOne({ _id: sub.planId }) : null
  const actor = await db.collection('users').findOne({ _id: actorUserId }, { projection: { name: 1, email: 1 } })

  let billingContactName = '—'
  let billingContactEmail = '—'

  if (sub.billingContactUserId) {
    const contact = await db
      .collection('users')
      .findOne({ _id: sub.billingContactUserId }, { projection: { name: 1, email: 1 } })

    billingContactName = String(contact?.name || '—')
    billingContactEmail = String(contact?.email || '—')
  }

  const actorName = String(actor?.name || (session as any)?.user?.name || '').trim() || 'Unknown'
  const actorEmail = String(actor?.email || email || '').trim() || '—'
  const companyName = String((tenant as any)?.name || '—')
  const legalName = String((tenant as any)?.legalName || '—')
  const gstin = String((tenant as any)?.gstin || '—')
  const gstBillingEmail = String((tenant as any)?.billingEmail || '—')
  const planName = String((plan as any)?.name || '—')
  const currency = String((plan as any)?.currency || 'INR')
  const interval = String(sub.billingInterval || 'monthly') === 'yearly' ? 'yearly' : 'monthly'
  const discountForPay = await ensureEligibleDiscountOnSubscription({
    db,
    tenantId,
    subscription: sub,
    plan: plan as any
  })
  const pricing = buildSubscriptionPricing({
    originalAmount: planPriceForInterval(plan as any, interval),
    currency,
    interval,
    snapshot: discountForPay.snapshot || (sub as any).discountSnapshot || null,
    discountName: discountForPay.discountName
  })
  const priceLabel = pricing.discount
    ? `${pricing.payableLabel} ${pricing.intervalSuffix} (was ${pricing.originalLabel}; ${pricing.discountCaption})`
    : `${pricing.payLabel}`
  const status = String(sub.status || '—')
  const trialEndsAt =
    sub.trialEndsAt instanceof Date
      ? sub.trialEndsAt.toISOString().slice(0, 10)
      : sub.trialEndsAt
        ? String(sub.trialEndsAt).slice(0, 10)
        : '—'
  const periodEnd =
    sub.currentPeriodEnd instanceof Date
      ? sub.currentPeriodEnd.toISOString().slice(0, 10)
      : sub.currentPeriodEnd
        ? String(sub.currentPeriodEnd).slice(0, 10)
        : '—'

  const subject = `Payment & activation request — ${companyName} (${planName})`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Payment &amp; activation request</h2>
      <p>An organisation asked Super Admin to verify a UPI payment and activate their subscription. They were shown the platform UPI QR / VPA on Payment &amp; activation.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 720px;">
        <tbody>
          ${row('Company', escapeHtml(companyName))}
          ${row('Legal name', escapeHtml(legalName))}
          ${row('GSTIN', escapeHtml(gstin))}
          ${row('GST billing email', escapeHtml(gstBillingEmail))}
          ${row('Plan', escapeHtml(planName))}
          ${row('Amount to pay', escapeHtml(priceLabel))}
          ${pricing.discountCaption ? row('Discount', escapeHtml(pricing.discountCaption)) : ''}
          ${row('Billing interval', escapeHtml(interval))}
          ${row('Subscription status', escapeHtml(status))}
          ${row('Trial ends', escapeHtml(trialEndsAt))}
          ${row('Current period end', escapeHtml(periodEnd))}
          ${row('Requested by', escapeHtml(`${actorName} (${actorEmail})`))}
          ${row('Requester role', escapeHtml(role || (isSuperAdmin ? 'SUPER_ADMIN' : '—')))}
          ${row('Billing contact', escapeHtml(`${billingContactName} (${billingContactEmail})`))}
          ${row('Tenant ID', escapeHtml(String(tenantId)))}
          ${row('Subscription ID', escapeHtml(String(sub._id)))}
          ${note ? row('Note', `<span style="white-space: pre-wrap;">${escapeHtml(note)}</span>`) : ''}
        </tbody>
      </table>
      <p style="margin-top: 16px;">Open Super Admin → Tenants to mark payment received and activate the paid period.</p>
    </div>
  `

  const text = [
    'Payment & activation request',
    '',
    'Customer was shown the platform UPI QR / VPA. Verify the transfer and mark payment received.',
    '',
    `Company: ${companyName}`,
    `Legal name: ${legalName}`,
    `GSTIN: ${gstin}`,
    `GST billing email: ${gstBillingEmail}`,
    `Plan: ${planName}`,
    `Amount to pay: ${priceLabel}`,
    pricing.discountCaption ? `Discount: ${pricing.discountCaption}` : '',
    `Billing interval: ${interval}`,
    `Subscription status: ${status}`,
    `Trial ends: ${trialEndsAt}`,
    `Current period end: ${periodEnd}`,
    `Requested by: ${actorName} (${actorEmail})`,
    `Requester role: ${role || (isSuperAdmin ? 'SUPER_ADMIN' : '—')}`,
    `Billing contact: ${billingContactName} (${billingContactEmail})`,
    `Tenant ID: ${String(tenantId)}`,
    `Subscription ID: ${String(sub._id)}`,
    note ? `Note: ${note}` : '',
    '',
    'Open Super Admin → Tenants to mark payment received and activate the paid period.'
  ]
    .filter(Boolean)
    .join('\n')

  await sendMail({
    to: recipients.join(','),
    subject,
    html,
    text
  })

  return NextResponse.json({ ok: true })
}
