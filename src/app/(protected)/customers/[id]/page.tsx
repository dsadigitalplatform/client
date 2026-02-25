import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { authOptions } from '@/lib/auth'
import CustomerDetails from '@features/customers/components/CustomerDetails'

const Page = async (props: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')
  const { id } = await props.params

  
return (
    <Box sx={{ px: { xs: 2, sm: 6 }, py: { xs: 2, sm: 6 }, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant='h4' sx={{ display: { xs: 'none', sm: 'block' } }}>
        Customer Details
      </Typography>
      <CustomerDetails id={id} />
    </Box>
  )
}

export default Page
