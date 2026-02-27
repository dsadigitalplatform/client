'use client'

import { useState } from 'react'

import { useSession } from 'next-auth/react'
import useSWR from 'swr'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

type InviteRole = 'ADMIN' | 'USER'

type InvitationPayload = {
  email: string
  role: InviteRole
  tenantId: string
}

type MembershipRole = 'OWNER' | 'ADMIN' | 'USER'
type MembershipStatus = 'invited' | 'active' | 'revoked'
type Membership = {
  _id?: string
  userId?: string
  email?: string
  role: MembershipRole
  status: MembershipStatus
}

const InviteUserForm = () => {
  const { data: session } = useSession()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [email, setEmail] = useState<string>('')
  const [role, setRole] = useState<InviteRole>('USER')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value)

  const sessionTenantId = (session as any)?.currentTenantId as string | undefined
  const [tenantId, setTenantId] = useState<string | undefined>(sessionTenantId)
  const membershipsUrl = tenantId ? `/api/memberships?tenantId=${tenantId}` : null
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data, isLoading, mutate } = useSWR(membershipsUrl, fetcher)

  // Resolve current tenant from server cookie if session is missing
  // This ensures switching via the profile menu or modal reflects here
  useSWR('/api/session/tenant', (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json()), {
    onSuccess: (res: any) => {
      const id = typeof res?.currentTenantId === 'string' ? res.currentTenantId : ''

      if (id && id !== tenantId) setTenantId(id)
    },
    revalidateOnFocus: false
  })

  const handleSubmit = async () => {
    setSuccessMsg(null)
    setErrorMsg(null)

    const currentId = tenantId

    if (!currentId) {
      setErrorMsg('No tenant selected')
      
return
    }

    if (!email.trim() || !isValidEmail(email.trim())) {
      setErrorMsg('Please enter a valid email')
      
return
    }

      const body: InvitationPayload = {
      email: email.trim(),
      role,
        tenantId: currentId
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to send invitation')
      }

      setSuccessMsg('Invitation sent')
      setEmail('')
      setRole('USER')
      mutate()
    } catch (e: any) {
      setErrorMsg(e.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  const raw = (data as any)?.memberships ?? data
  const list: Membership[] = Array.isArray(raw) ? raw : []
  const members = list.filter(m => m.status === 'invited' || m.status === 'active')
  const meUserId = (session as any)?.userId as string | undefined
  const meEmail = (session as any)?.user?.email as string | undefined

  const filtered = members.filter(m => {
    if (m.userId && meUserId && m.userId === meUserId) return false
    if (meEmail && m.email && m.email.toLowerCase() === meEmail.toLowerCase()) return false

    return true
  })

  const statusLabel = (s: MembershipStatus) => s.charAt(0).toUpperCase() + s.slice(1)

  const statusColor = (s: MembershipStatus) => {
    if (s === 'active') return 'success'
    if (s === 'invited') return 'primary'

    return 'default'
  }

  return (
    <Box className='flex flex-col gap-4'>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Typography variant='h6'>Invite Users</Typography>
        <Typography variant='body2' color='text.secondary'>
          Send invitations to join your organisation.
        </Typography>
      </Box>
      {successMsg ? <Alert severity='success'>{successMsg}</Alert> : null}
      {errorMsg ? <Alert severity='error'>{errorMsg}</Alert> : null}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <TextField
          label='Email'
          type='email'
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          fullWidth
        />
        <FormControl fullWidth={isMobile} sx={{ minWidth: { sm: 220 } }}>
          <InputLabel id='invite-role-label'>Role</InputLabel>
          <Select
            labelId='invite-role-label'
            label='Role'
            value={role}
            onChange={e => setRole(e.target.value as InviteRole)}
          >
            <MenuItem value='ADMIN'>Admin</MenuItem>
            <MenuItem value='USER'>User</MenuItem>
          </Select>
        </FormControl>
      </Box>
      <Button variant='contained' disabled={submitting} onClick={handleSubmit} fullWidth={isMobile} startIcon={<i className='ri-send-plane-2-line' />}>
        {submitting ? 'Sending...' : 'Send Invitation'}
      </Button>
      <Box className='flex flex-col gap-2'>
        <Typography variant='h6'>Invited Users</Typography>
        {isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {isLoading ? (
              <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Loading...
                  </Typography>
                </CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                <CardContent sx={{ p: 2 }}>
                  <Typography variant='body2' color='text.secondary'>
                    No invited users
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              filtered.map((m, idx) => (
                <Card
                  key={m._id ?? idx}
                  sx={{
                    borderRadius: 3,
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper'
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'text.secondary' }}>
                        <i className='ri-user-3-line text-lg' />
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant='subtitle1' sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                          {m.email ?? '—'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          <Chip
                            size='small'
                            variant='outlined'
                            label={m.role}
                            sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)' }}
                          />
                          <Chip size='small' variant='outlined' color={statusColor(m.status)} label={statusLabel(m.status)} sx={{ boxShadow: 'none' }} />
                        </Box>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
        ) : (
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3}>Loading...</TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>No members</TableCell>
                </TableRow>
              ) : (
                filtered.map((m, idx) => (
                  <TableRow key={m._id ?? idx}>
                    <TableCell>{m.email ?? ''}</TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell>{statusLabel(m.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  )
}

export default InviteUserForm
