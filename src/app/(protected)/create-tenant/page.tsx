import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from 'next/link'

import { authOptions } from '@/lib/auth'
import { CreateTenantForm } from '@features/tenants'

const CreateTenantPage = async () => {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Create Tenant</Typography>
      <Typography color='text.secondary'>You have no active memberships.</Typography>
      <CreateTenantForm />
      <Link href='/home'>
        <Button variant='contained'>Skip for now</Button>
      </Link>
    </Box>
  )
}

export default CreateTenantPage
