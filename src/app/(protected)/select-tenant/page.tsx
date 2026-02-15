import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

import { authOptions } from '@/lib/auth'

async function setTenant(tenantId: string) {
  'use server'
  const host = (await headers()).get('host') || 'localhost:3000'
  const origin = process.env.NEXTAUTH_URL || `http://${host}`
  const res = await fetch(`${origin}/api/session/tenant?redirect=/home`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ tenantId }).toString(),
    cache: 'no-store'
  })
  if (!res.ok) throw new Error('Failed to set tenant')
}

const SelectTenantPage = async () => {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const tenantIds = (session as any).tenantIds || []
  if (tenantIds.length <= 1) redirect('/home')

  return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Select Tenant</Typography>
      <Box className='flex flex-col gap-2'>
        {tenantIds.map((id: string) => (
          <form key={id} action={async () => setTenant(id)}>
            <Button type='submit' variant='outlined'>{id}</Button>
          </form>
        ))}
      </Box>
    </Box>
  )
}

export default SelectTenantPage
