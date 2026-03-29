import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { authOptions } from '@/lib/auth'
import { ProfileForm } from '@features/profile'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')

  return (
    <Box
      sx={{
        mx: { xs: -2, sm: 0 },
        px: { xs: 0, sm: 6 },
        py: { xs: 2, sm: 6 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <Typography variant='h4' sx={{ display: { xs: 'none', sm: 'block' } }}>
        My Profile
      </Typography>
      <ProfileForm />
    </Box>
  )
}

export default Page
