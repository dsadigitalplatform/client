import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { authOptions } from '@/lib/auth'
import { SubscriptionPlansManager } from '@/features/subscription-plans'

const Page = async () => {
    const session = await getServerSession(authOptions)

    if (!session?.userId) redirect('/login')
    if (!(session as any).isSuperAdmin) redirect('/home')

    return (
        <Box className='p-6 flex flex-col gap-4'>
            <Typography variant='h4'>Subscription Plans</Typography>
            <SubscriptionPlansManager />
        </Box>
    )
}

export default Page
