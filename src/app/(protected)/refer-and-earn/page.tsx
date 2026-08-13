import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'

import { authOptions } from '@/lib/auth'
import ReferralAdPage from '@features/referrals/components/ReferralAdPage'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')

  return (
    <Box sx={{ mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 6 }, py: { xs: 2, sm: 4 } }}>
      <ReferralAdPage />
    </Box>
  )
}

export default Page
