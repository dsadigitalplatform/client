'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { signOut, useSession } from 'next-auth/react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'

type AcceptInviteViewProps = {
  token: string
}

type AcceptResponse =
  | { success: true; tenantId: string }
  | { error: 'invalid_token' | 'email_mismatch' | 'internal_error' }

const AcceptInviteView = ({ token }: AcceptInviteViewProps) => {
  const router = useRouter()
  const { status, data: session } = useSession()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [details, setDetails] = useState<{ tenantName?: string; role?: string; invitedEmail?: string; emailMatches?: boolean } | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invitation token is missing')
    }
  }, [token])

  useEffect(() => {
    if (!token) return

    if (status === 'unauthenticated') {
      const callbackUrl = `/accept-invite?token=${encodeURIComponent(token)}`

      router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)

      return
    }
  }, [status, token, router])

  useEffect(() => {
    const run = async () => {
      if (!token || status !== 'authenticated') return

      try {
        const res = await fetch(`/api/invitations/validate?token=${encodeURIComponent(token)}`, { cache: 'no-store' })

        if (res.ok) {
          const data = await res.json()

          setDetails({
            tenantName: data?.tenantName,
            role: data?.role,
            invitedEmail: data?.invitedEmail,
            emailMatches: Boolean(data?.emailMatches)
          })
        } else {
          const d = await res.json().catch(() => ({}))

          if (d?.error === 'not_found') setError('Invitation link is invalid or expired.')
        }
      } catch {}
    }

    run()
  }, [status, token])

  const handleAccept = async () => {
    if (!token) return
    setProcessing(true)
    setError(null)

    try {
      const res = await fetch('/api/invitations/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const data: AcceptResponse = await res.json()

      if (!res.ok) {
        const err = (data as any)?.error

        if (err === 'invalid_token' || err === 'already_accepted') {
          try {
            const b = await fetch('/api/session/bootstrap', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))

            if (Number(b?.memberships?.count || 0) > 0) {
              await signOut({ callbackUrl: '/login' })
              
return
            }
          } catch {}
        }

        if (err === 'email_mismatch') {
          setError('This invite was sent to another email. Please sign in with the invited email.')
        } else if (err === 'invalid_token') {
          setError('Invitation link is invalid or expired.')
        } else {
          setError('An unexpected error occurred.')
        }

        setProcessing(false)
        
return
        
return
      }

      try {
        await signOut({ callbackUrl: '/login' })
      } finally {
        setProcessing(false)
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.')
      setProcessing(false)
    }
  }

  return (
    <Box className='flex flex-col gap-4'>
      {error ? <Alert severity='error'>{error}</Alert> : null}
      <Typography>You have been invited to join an organisation.</Typography>
      {details ? (
        <Box className='flex flex-col gap-1'>
          <Typography>Organisation: {details.tenantName || '—'}</Typography>
          <Typography>Role: {details.role || '—'}</Typography>
          <Typography>Invited Email: {details.invitedEmail || '—'}</Typography>
          <Typography>Signed in as: {String((session as any)?.user?.email || '—')}</Typography>
          {!details.emailMatches ? (
            <Alert severity='warning'>Please sign in with the invited email to accept this invitation.</Alert>
          ) : null}
        </Box>
      ) : null}
      <Button variant='contained' disabled={processing} onClick={handleAccept}>
        {processing ? 'Accepting…' : 'Accept Invitation'}
      </Button>
      {!details?.emailMatches ? (
        <Button variant='outlined' onClick={() => signOut({ callbackUrl: '/login' })}>Switch Account</Button>
      ) : null}
    </Box>
  )
}

export default AcceptInviteView
