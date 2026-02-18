'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'

type TenantType = 'sole_trader' | 'company'
type CreateResponse = { tenantId: string }

export const CreateTenantForm = () => {
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [type, setType] = useState<TenantType>('sole_trader')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!name.trim()) {
      setError('Please enter a tenant name')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type })
      })
      const data: CreateResponse = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create tenant')
      }
      router.replace('/home')
    } catch (e: any) {
      setError(e.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box className='flex flex-col gap-4'>
      <Typography variant='h4'>Create Organisation</Typography>
      <TextField label='Organisation Name' value={name} onChange={e => setName(e.target.value)} />
      <FormControl>
        <InputLabel id='tenant-type-label'>Type</InputLabel>
        <Select
          labelId='tenant-type-label'
          label='Type'
          value={type}
          onChange={e => setType(e.target.value as TenantType)}
        >
          <MenuItem value='sole_trader'>Sole Trader</MenuItem>
          <MenuItem value='company'>Company</MenuItem>
        </Select>
      </FormControl>
      {error ? <Typography color='error'>{error}</Typography> : null}
      <Button variant='contained' disabled={submitting} onClick={handleSubmit}>
        {submitting ? 'Creating...' : 'Create'}
      </Button>
    </Box>
  )
}
