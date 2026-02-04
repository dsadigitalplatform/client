'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { createCustomer } from '@features/customers/services/customersService'
 
 const CustomersCreateForm = () => {
   const router = useRouter()
   const [name, setName] = useState('')
   const [email, setEmail] = useState('')
   const [submitting, setSubmitting] = useState(false)
 
   const handleSubmit = async () => {
     if (!name || !email) return
     setSubmitting(true)
     await createCustomer({ name, email })
     setSubmitting(false)
     router.push('/customers')
   }
 
   return (
     <Box className='flex flex-col gap-4'>
       <Typography variant='h4'>Create Customer</Typography>
       <TextField label='Name' value={name} onChange={e => setName(e.target.value)} />
       <TextField label='Email' value={email} onChange={e => setEmail(e.target.value)} />
       <Button variant='contained' disabled={submitting} onClick={handleSubmit}>
         {submitting ? 'Creating...' : 'Create'}
       </Button>
     </Box>
   )
 }
 
 export default CustomersCreateForm
