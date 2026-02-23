import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { CreateTenantForm } from '@features/tenants'
import { getDb } from '@/lib/mongodb'

const CreateTenantPage = async () => {
    const session = await getServerSession(authOptions)

    if (!session) redirect('/login')

    const db = await getDb()
    const userId = new ObjectId((session as any).userId)

    const activeMembership = await db
        .collection('memberships')
        .findOne({ userId, status: 'active' }, { sort: { createdAt: -1 }, projection: { role: 1 } })

    const hasActiveMembership = Boolean(activeMembership)

    return (
        <Box className='p-6 flex flex-col gap-4'>
            <Typography variant='h4'>Create Organisation</Typography>
            {!hasActiveMembership ? (
                <Typography color='text.secondary'>You have no active memberships.</Typography>
            ) : (
                <Typography color='text.secondary'>You can create another tenant as Owner.</Typography>
            )}
            <CreateTenantForm />

        </Box>
    )
}

export default CreateTenantPage
