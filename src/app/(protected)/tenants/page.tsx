import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { authOptions } from '@/lib/auth'
import { TenantsList } from '@features/tenants'

const TenantsPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  
return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Organisations</Typography>
      <TenantsList />
    </Box>
  )
}

export default TenantsPage
