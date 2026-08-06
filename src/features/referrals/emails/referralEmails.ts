import 'server-only'

import type { ReferralPayoutDetails } from '../referrals.types'

function appOrigin() {
  const base =
    process.env.INVITE_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000'

  return base.startsWith('http') ? base : `https://${base}`
}

export function buildReferralLink(token: string) {
  return `${appOrigin()}/create-tenant?ref=${encodeURIComponent(token)}`
}

export function buildReferralInviteeEmail(params: {
  inviteeName: string | null
  referrerName: string
  headline: string
  commissionPercent: number
  link: string
}) {
  const greeting = params.inviteeName ? `Hi ${params.inviteeName},` : 'Hi,'
  const subject = `${params.referrerName} invited you to join our DSA platform`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px;">
      <h2 style="margin-bottom: 8px;">${params.headline}</h2>
      <p>${greeting}</p>
      <p><strong>${params.referrerName}</strong> thinks you would benefit from our Direct Sales Agent platform.</p>
      <p>Create your organisation and start managing leads, associates, and disbursements in one place.</p>
      <p>
        <a href="${params.link}" style="display:inline-block;padding:12px 20px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Get started
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">If the button does not work, copy this link:<br/><a href="${params.link}">${params.link}</a></p>
      <p style="font-size: 12px; color: #777;">Your referrer may earn ${params.commissionPercent}% recurring commission when you pay for a subscription, subject to program terms.</p>
    </div>
  `

  const text = `${greeting}\n\n${params.referrerName} invited you to our DSA platform.\nGet started: ${params.link}\n`

  return { subject, html, text }
}

export function buildReferralInviteAdminEmail(params: {
  referrerName: string
  referrerEmail: string
  inviteeName: string | null
  inviteeEmail: string
  inviteeMobile: string
  inviteId: string
}) {
  const adminLink = `${appOrigin()}/super-admin/referrals?invite=${encodeURIComponent(params.inviteId)}`
  const subject = `New DSA referral invite from ${params.referrerName}`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 560px;">
      <h2>New referral invite</h2>
      <p>A team member referred a prospective DSA. You can help them onboard and link the organisation when ready.</p>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #666;">Referrer</td><td style="padding: 6px 0;"><strong>${params.referrerName}</strong> (${params.referrerEmail || '—'})</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Invitee name</td><td style="padding: 6px 0;">${params.inviteeName || '—'}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Invitee email</td><td style="padding: 6px 0;">${params.inviteeEmail}</td></tr>
        <tr><td style="padding: 6px 0; color: #666;">Invitee mobile</td><td style="padding: 6px 0;">${params.inviteeMobile}</td></tr>
      </table>
      <p style="margin-top: 16px;">
        <a href="${adminLink}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Open in Referrals</a>
      </p>
    </div>
  `

  const text = `New referral from ${params.referrerName} (${params.referrerEmail}). Invitee: ${params.inviteeName || ''} ${params.inviteeEmail} / ${params.inviteeMobile}. ${adminLink}`

  return { subject, html, text }
}

export function buildReferralWithdrawalAdminEmail(params: {
  referrerName: string
  referrerEmail: string
  amount: number
  creditCount: number
  payoutDetails: ReferralPayoutDetails
  withdrawalId: string
}) {
  const adminLink = `${appOrigin()}/super-admin/referrals?tab=withdrawals&id=${encodeURIComponent(params.withdrawalId)}`
  const subject = `Referral withdrawal request — ₹${params.amount.toLocaleString('en-IN')}`
  const pd = params.payoutDetails
  const payoutLine =
    pd.method === 'upi'
      ? `UPI: ${pd.upiId || '—'}`
      : `Bank: ${pd.accountName || '—'} / ${pd.accountNumber || '—'} / IFSC ${pd.ifsc || '—'}`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 560px;">
      <h2>Withdrawal requested</h2>
      <p><strong>${params.referrerName}</strong> (${params.referrerEmail}) requested a payout of <strong>₹${params.amount.toLocaleString('en-IN')}</strong> across ${params.creditCount} credit(s).</p>
      <p>${payoutLine}</p>
      <p>
        <a href="${adminLink}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Review withdrawal</a>
      </p>
    </div>
  `

  const text = `Withdrawal ₹${params.amount} from ${params.referrerName}. ${payoutLine}. ${adminLink}`

  return { subject, html, text }
}
