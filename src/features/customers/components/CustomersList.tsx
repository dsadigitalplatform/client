'use client'

import { useState } from 'react'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

import { useCustomers } from '@features/customers/hooks/useCustomers'
import CustomersCreateForm from '@features/customers/components/CustomersCreateForm'

const CustomersList = () => {
  const { customers, loading, search, setSearch, refresh } = useCustomers()
  const [openAdd, setOpenAdd] = useState(false)

  const handleExport = () => {
    const rows = [
      ['Full Name', 'Mobile', 'Email', 'Employment Type', 'Monthly Income', 'CIBIL', 'Source'],
      ...customers.map(c => [
        c.fullName,
        c.mobile,
        c.email ?? '',
        c.employmentType,
        c.monthlyIncome != null ? String(c.monthlyIncome) : '',
        c.cibilScore != null ? String(c.cibilScore) : '',
        c.source
      ])
    ]
    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customers.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // simple table view; pagination/search can be added later
  return (
    <Box className='flex flex-col gap-4'>
      <Box className='flex items-center gap-2 justify-between'>
        <Box className='flex items-center gap-2'>
          <TextField
            size='small'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by name, email or mobile'
            onKeyDown={e => {
              if (e.key === 'Enter') refresh()
            }}
          />
          <Button variant='contained' onClick={refresh}>
            Search
          </Button>
        </Box>
        <Box className='flex items-center gap-2'>
          <Button variant='outlined' onClick={handleExport} startIcon={<i className='ri-download-line' />}>
            Export
          </Button>
          <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={() => setOpenAdd(true)}>
            Add Customer
          </Button>
        </Box>
      </Box>
      <Drawer anchor='right' open={openAdd} onClose={() => setOpenAdd(false)} keepMounted>
        <Box sx={{ width: { xs: 380, sm: 480, md: 520 }, p: 3, '& .MuiTextField-root': { mb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant='h6' color='text.primary'>
              Add a Customer
            </Typography>
            <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add customer'>
              <i className='ri-close-line' />
            </IconButton>
          </Box>
          <CustomersCreateForm
            showTitle={false}
            onSuccess={() => {
              setOpenAdd(false)
              refresh()
            }}
            onCancel={() => setOpenAdd(false)}
          />
        </Box>
      </Drawer>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Mobile</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Employment</TableCell>
            <TableCell>Income</TableCell>
            <TableCell>CIBIL</TableCell>
            <TableCell>Source</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7}>Loading...</TableCell>
            </TableRow>
          ) : customers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>No customers found</TableCell>
            </TableRow>
          ) : (
            customers.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.fullName}</TableCell>
                <TableCell>{c.mobile}</TableCell>
                <TableCell>{c.email || '-'}</TableCell>
                <TableCell>
                  <Chip
                    label={c.employmentType === 'SALARIED' ? 'Salaried' : 'Self-employed'}
                    size='small'
                    color={c.employmentType === 'SALARIED' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>{c.monthlyIncome != null ? c.monthlyIncome : '-'}</TableCell>
                <TableCell>{c.cibilScore != null ? c.cibilScore : '-'}</TableCell>
                <TableCell>{c.source.replace('_', ' ')}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box >
  )
}

export default CustomersList
