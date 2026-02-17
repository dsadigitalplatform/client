'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

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
  const { status } = useSession()

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    if (status === 'authenticated') {
      const accept = async () => {
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
            const msg =
              (data as any)?.error === 'email_mismatch'
                ? 'This invite was sent to another email. Please sign in with the invited email.'
                : (data as any)?.error === 'invalid_token'
                ? 'Invitation link is invalid or expired.'
                : 'An unexpected error occurred.'
            setError(msg)
            setProcessing(false)
            return
          }
          router.replace('/home')
        } catch (e: any) {
          setError(e.message || 'An unexpected error occurred.')
          setProcessing(false)
        }
      }
      accept()
    }
  }, [status, token, router])

  return (
    <Box className='flex flex-col gap-4'>
      {error ? <Alert severity='error'>{error}</Alert> : null}
      {processing ? (
        <Typography>Processing invitation...</Typography>
      ) : (
        <>
          <Typography>Click the button if the redirect does not start automatically.</Typography>
          <Button
            variant='contained'
            onClick={() => {
              if (!token) return
              if (status === 'unauthenticated') {
                const callbackUrl = `/accept-invite?token=${encodeURIComponent(token)}`
                router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
              } else if (status === 'authenticated') {
                // Trigger re-run by toggling state
                setProcessing(true)
                setError(null)
                fetch('/api/invitations/accept', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token })
                })
                  .then(async res => {
                    const data: AcceptResponse = await res.json()
                    if (!res.ok) {
                      const msg =
                        (data as any)?.error === 'email_mismatch'
                          ? 'This invite was sent to another email. Please sign in with the invited email.'
                          : (data as any)?.error === 'invalid_token'
                          ? 'Invitation link is invalid or expired.'
                          : 'An unexpected error occurred.'
                      setError(msg)
                      setProcessing(false)
                      return
                    }
                    router.replace('/home')
                  })
                  .catch(e => {
                    setError(e.message || 'An unexpected error occurred.')
                    setProcessing(false)
                  })
              }
            }}
          >
            Continue
          </Button>
        </>
      )}
    </Box>
  )
}

export default AcceptInviteView
