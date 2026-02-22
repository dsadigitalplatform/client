import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import type { Metadata } from 'next'

import AcceptInviteView from '@features/invitations/components/AcceptInviteView'

export const metadata: Metadata = {
    title: 'Accept Invitation',
    description: 'Accept tenant invitation'
}

export const dynamic = 'force-dynamic'

const Page = async ({
    searchParams
}: {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) => {
    const sp = (await searchParams) || {}
    const raw = sp.token
    const token = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] || '' : ''

    return (
        <Box className='p-6'>
            <Typography variant='h4' className='mb-4'>
                Accept Invitation
            </Typography>
            <AcceptInviteView token={token} />
        </Box>
    )
}

export default Page
