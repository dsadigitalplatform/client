import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'

import { authOptions } from '@/lib/auth'
import RewardsPage from '@features/referrals/components/RewardsPage'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')

  return (
    <Box sx={{ mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 6 }, py: { xs: 2, sm: 4 } }}>
      <RewardsPage />
    </Box>
  )
}

export default Page
