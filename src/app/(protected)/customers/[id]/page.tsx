import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { authOptions } from '@/lib/auth'
import CustomerDetails from '@features/customers/components/CustomerDetails'

const Page = async (props: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const tenantIds = ((session as any)?.tenantIds as string[] | undefined) || []

  if (tenantIds.length === 0) redirect('/home')
  const { id } = await props.params

  
return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Customer Details</Typography>
      <CustomerDetails id={id} />
    </Box>
  )
}

export default Page
