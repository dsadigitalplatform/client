 'use client'
 
 import Box from '@mui/material/Box'
 import Typography from '@mui/material/Typography'
 
 const DashboardHome = () => {
   return (
     <Box className='flex flex-col gap-4'>
       <Typography variant='h4'>Dashboard</Typography>
       <Typography color='text.secondary'>Welcome to your dashboard.</Typography>
     </Box>
   )
 }
 
 export default DashboardHome
