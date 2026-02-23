import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { authOptions } from '@/lib/auth'
import LoanTypeDetails from '@features/loan-types/components/LoanTypeDetails'

const Page = async (props: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')
  const { id } = await props.params

  return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Loan Type Details</Typography>
      <LoanTypeDetails id={id} />
    </Box>
  )
}

export default Page
