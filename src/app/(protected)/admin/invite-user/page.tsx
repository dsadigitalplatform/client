import Box from '@mui/material/Box'

import InviteUserForm from '@features/tenants/components/InviteUserForm'
import { OrganisationHeader } from '@features/tenants/components/OrganisationHeader'

const InviteUserPage = async () => {
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
      <OrganisationHeader title='Invite Users' />
      <InviteUserForm />
    </Box>
  )
}

export default InviteUserPage
