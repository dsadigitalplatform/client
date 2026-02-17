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
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'

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
  email?: string
  role: MembershipRole
  status: MembershipStatus
}

const InviteUserForm = () => {
  const { data: session } = useSession()

  const [email, setEmail] = useState<string>('')
  const [role, setRole] = useState<InviteRole>('USER')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value)

  const tenantId = (session as any)?.currentTenantId as string | undefined
  const membershipsUrl = tenantId ? `/api/memberships?tenantId=${tenantId}` : null
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data, isLoading, mutate } = useSWR(membershipsUrl, fetcher)

  const handleSubmit = async () => {
    setSuccessMsg(null)
    setErrorMsg(null)

    const tenantId = (session as any)?.currentTenantId as string | undefined

    if (!tenantId) {
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
      tenantId
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

  return (
    <Box className='flex flex-col gap-4'>
      <Typography variant='h6'>Invite a user to your tenant</Typography>
      {successMsg ? <Alert severity='success'>{successMsg}</Alert> : null}
      {errorMsg ? <Alert severity='error'>{errorMsg}</Alert> : null}
      <TextField
        label='Email'
        type='email'
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <FormControl>
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
      <Button variant='contained' disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Sending...' : 'Send Invitation'}
      </Button>
      <Box className='flex flex-col gap-2'>
        <Typography variant='h6'>Invited Users</Typography>
        <Table>
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
            ) : (() => {
              const raw = (data as any)?.memberships ?? data
              const list: Membership[] = Array.isArray(raw) ? raw : []
              const members = list.filter(m => m.status === 'invited' || m.status === 'active')
              if (members.length === 0) {
                return (
                  <TableRow>
                    <TableCell colSpan={3}>No members</TableCell>
                  </TableRow>
                )
              }
              const label = (s: MembershipStatus) => s.charAt(0).toUpperCase() + s.slice(1)
              return members.map((m, idx) => (
                <TableRow key={m._id ?? idx}>
                  <TableCell>{m.email ?? ''}</TableCell>
                  <TableCell>{m.role}</TableCell>
                  <TableCell>{label(m.status)}</TableCell>
                </TableRow>
              ))
            })()}
          </TableBody>
        </Table>
      </Box>
    </Box>
  )
}

export default InviteUserForm
