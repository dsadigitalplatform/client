import Box from '@mui/material/Box'
import InviteUserForm from '@features/tenants/components/InviteUserForm'
import { OrganisationHeader } from '@features/tenants/components/OrganisationHeader'

const InviteUserPage = async () => {
  return (
    <Box className='p-6 flex flex-col gap-4'>
      <OrganisationHeader title='Invite Users' />
      <InviteUserForm />
    </Box>
  )
}

export default InviteUserPage
