import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { TenantDetails } from '@features/tenants/components/TenantDetails'

const TenantDetailsPage = async (props: { params: Promise<{ id: string }> }) => {
  const { id } = await props.params
  return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Organisation Details</Typography>
      <TenantDetails id={id} />
    </Box>
  )
}

export default TenantDetailsPage
