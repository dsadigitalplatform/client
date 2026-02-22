import 'server-only'

type MailOptions = {
  to: string
  subject: string
  html: string
  text?: string
}

function getEnv(name: string, optional = false): string | undefined {
  const v = process.env[name]

  if (!v && !optional) {
    throw new Error(`${name} is missing in environment variables`)
  }

  return v
}

export async function sendMail(options: MailOptions) {
  const { default: nodemailer } = await import('nodemailer')
  const host = getEnv('SMTP_HOST')
  const portStr = getEnv('SMTP_PORT')
  const from = getEnv('SMTP_FROM')
  const user = getEnv('SMTP_USER', true)
  const pass = getEnv('SMTP_PASS', true)

  const port = Number(portStr)
  const secure = port === 465

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  })

  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text
  })
}

export function buildInviteLink(token: string) {
  const base =
    process.env.INVITE_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000'
  const origin = base.startsWith('http') ? base : `https://${base}`

  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`
}

export async function sendInvitationEmail(to: string, tenantName: string, token: string) {
  const link = buildInviteLink(token)
  const subject = `You are invited to join ${tenantName}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <h2>Invitation to ${tenantName}</h2>
      <p>You have been invited to join <strong>${tenantName}</strong>.</p>
      <p>This invitation expires in 48 hours.</p>
      <p>
        <a href="${link}" style="display:inline-block;padding:10px 16px;background:#635bff;color:#fff;text-decoration:none;border-radius:6px;">Accept Invitation</a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${link}">${link}</a></p>
    </div>
  `

  await sendMail({ to, subject, html, text: `Accept your invitation: ${link}` })
}
