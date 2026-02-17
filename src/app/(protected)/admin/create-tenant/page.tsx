import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from 'next/link'

import { authOptions } from '@/lib/auth'
import { CreateTenantForm } from '@features/tenants'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

const CreateTenantAdminPage = async () => {
    const session = await getServerSession(authOptions)
    if (!session) redirect('/login')

    const db = await getDb()
    let role: 'OWNER' | 'ADMIN' | 'USER' | undefined
    if ((session as any).currentTenantId) {
        const membership = await db
            .collection('memberships')
            .findOne(
                { userId: new ObjectId((session as any).userId), tenantId: new ObjectId((session as any).currentTenantId), status: 'active' },
                { projection: { role: 1 } }
            )
        role = membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined
    } else {
        const membership = await db
            .collection('memberships')
            .findOne({ userId: new ObjectId((session as any).userId), status: 'active' }, { sort: { createdAt: -1 }, projection: { role: 1 } })
        role = membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined
    }

    if (role !== 'OWNER') redirect('/home')

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

export default CreateTenantAdminPage
