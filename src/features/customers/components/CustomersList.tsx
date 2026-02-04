 'use client'
 
 import TextField from '@mui/material/TextField'
 import Button from '@mui/material/Button'
 import Table from '@mui/material/Table'
 import TableBody from '@mui/material/TableBody'
 import TableCell from '@mui/material/TableCell'
 import TableHead from '@mui/material/TableHead'
 import TableRow from '@mui/material/TableRow'
 import Box from '@mui/material/Box'
 import Typography from '@mui/material/Typography'

import { useCustomers } from '@features/customers/hooks/useCustomers'
 
 const CustomersList = () => {
   const { customers, loading, search, setSearch, refresh } = useCustomers()
 
   return (
     <Box className='flex flex-col gap-4'>
       <Typography variant='h4'>Customers</Typography>
       <Box className='flex items-center gap-2'>
         <TextField size='small' value={search} onChange={e => setSearch(e.target.value)} placeholder='Search' />
         <Button variant='contained' onClick={refresh}>
           Search
         </Button>
       </Box>
       <Table>
         <TableHead>
           <TableRow>
             <TableCell>Name</TableCell>
             <TableCell>Email</TableCell>
             <TableCell>Created</TableCell>
           </TableRow>
         </TableHead>
         <TableBody>
           {loading ? (
             <TableRow>
               <TableCell colSpan={3}>Loading...</TableCell>
             </TableRow>
           ) : customers.length === 0 ? (
             <TableRow>
               <TableCell colSpan={3}>No customers found</TableCell>
             </TableRow>
           ) : (
             customers.map(c => (
               <TableRow key={c.id}>
                 <TableCell>{c.name}</TableCell>
                 <TableCell>{c.email}</TableCell>
                 <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
               </TableRow>
             ))
           )}
         </TableBody>
       </Table>
     </Box>
   )
 }
 
 export default CustomersList
