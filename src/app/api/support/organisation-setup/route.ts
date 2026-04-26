export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getSupportRecipientEmails } from '@/lib/env'
import { sendMail } from '@/lib/mailer'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function isValidEmail(value: string): boolean {
  return /^.+@.+\..+$/.test(value)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))

  const fullName = String(body?.fullName || '').trim()
  const countryCode = String(body?.countryCode || '').trim()
  const mobile = String(body?.mobile || '').trim()
  const email = String(body?.email || '').trim()
  const description = String(body?.description || '').trim()
  const errors: Record<string, string> = {}

  if (fullName.length < 2) errors.fullName = 'invalid_full_name'
  if (!/^\+[0-9]{1,4}$/.test(countryCode)) errors.countryCode = 'invalid_country_code'
  if (!/^[0-9]{9,10}$/.test(mobile)) errors.mobile = 'invalid_mobile'
  if (!isValidEmail(email)) errors.email = 'invalid_email'
  if (description.length < 10 || description.length > 2000) errors.description = 'invalid_description'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const recipients = getSupportRecipientEmails()

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'support_recipients_not_configured' }, { status: 500 })
  }

  const actorName = String((session as any)?.user?.name || '').trim() || fullName
  const actorEmail = String((session as any)?.user?.email || '').trim() || email
  const subject = `Organisation Setup Support Request - ${actorName}`

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Organisation Setup Support Request</h2>
      <p>A user submitted a request for new organisation setup.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 680px;">
        <tbody>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Full Name</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(fullName)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Contact Number</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(countryCode)} ${escapeHtml(mobile)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Description</strong></td><td style="padding: 8px; border: 1px solid #ddd; white-space: pre-wrap;">${escapeHtml(description)}</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Session User</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(actorName)} (${escapeHtml(actorEmail)})</td></tr>
          <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>User ID</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(String((session as any)?.userId || ''))}</td></tr>
        </tbody>
      </table>
    </div>
  `

  const text = [
    'Organisation Setup Support Request',
    '',
    `Full Name: ${fullName}`,
    `Contact Number: ${countryCode} ${mobile}`,
    `Email: ${email}`,
    `Description: ${description}`,
    `Session User: ${actorName} (${actorEmail})`,
    `User ID: ${String((session as any)?.userId || '')}`
  ].join('\n')

  await sendMail({
    to: recipients.join(','),
    subject,
    html,
    text
  })

  return NextResponse.json({ ok: true })
}
