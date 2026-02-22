'use client'

import { useState } from 'react'

import Link from 'next/link'

import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import MuiLink from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'

import { useCustomers } from '@features/customers/hooks/useCustomers'
import CustomersCreateForm from '@features/customers/components/CustomersCreateForm'

const CustomersList = () => {
  const { customers, loading, search, setSearch, refresh } = useCustomers()
  const [openAdd, setOpenAdd] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)

  const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

  const sourceMeta = (v: string) => {
    switch (v) {
      case 'WALK_IN':
        return { label: 'Walk-in', icon: 'ri-walk-line' }
      case 'REFERRAL':
        return { label: 'Referral', icon: 'ri-user-shared-line' }
      case 'ONLINE':
        return { label: 'Online', icon: 'ri-global-line' }
      case 'SOCIAL_MEDIA':
        return { label: 'Social Media', icon: 'ri-share-circle-line' }
      default:
        return { label: 'Other', icon: 'ri-more-2-line' }
    }
  }

  const cibilMeta = (v: number) => {
    if (v >= 750) return { label: 'High', color: 'success' as const, icon: 'ri-arrow-up-s-line' }
    if (v >= 650) return { label: 'Average', color: 'warning' as const, icon: 'ri-equalizer-line' }
    
return { label: 'Low', color: 'error' as const, icon: 'ri-alert-line' }
  }

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
              setSuccessOpen(true)
            }}
            onCancel={() => setOpenAdd(false)}
          />
        </Box>
      </Drawer>
      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccessOpen(false)}
          severity='success'
          variant='filled'
          icon={<i className='ri-checkbox-circle-line' />}
          sx={{
            width: '100%',
            bgcolor: 'var(--mui-palette-success-main)',
            color: 'var(--mui-palette-common-white)',
            borderRadius: 2,
            boxShadow: 6,
            '& .MuiAlert-icon': {
              color: 'var(--mui-palette-common-white)'
            }
          }}
        >
          Customer added successfully
        </Alert>
      </Snackbar>
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
                <TableCell>
                  <Box className='flex items-center gap-2'>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                      aria-label={`${c.fullName} avatar`}
                    >
                      {c.fullName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map(s => s[0]?.toUpperCase())
                        .join('')}
                    </Avatar>
                    <MuiLink
                      component={Link}
                      href={`/customers/${c.id}`}
                      underline='hover'
                      color='text.primary'
                      sx={{
                        fontSize: '0.95rem',
                        fontWeight: 500,
                        transition: 'color .2s ease, font-size .2s ease',
                        '&:hover': {
                          color: 'primary.main',
                          fontSize: '1.02rem'
                        }
                      }}
                    >
                      {c.fullName}
                    </MuiLink>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-smartphone-line text-lg' />
                    <span>{c.mobile}</span>
                  </Box>
                </TableCell>
                <TableCell>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-mail-line text-lg' />
                    <span>{c.email || '-'}</span>
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip
                    label={c.employmentType === 'SALARIED' ? 'Salaried' : 'Self-employed'}
                    size='small'
                    color={c.employmentType === 'SALARIED' ? 'primary' : 'secondary'}
                  />
                </TableCell>
                <TableCell>
                  {c.monthlyIncome != null ? (
                    <span>{formatINR(c.monthlyIncome)}</span>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {c.cibilScore != null ? (
                    (() => {
                      const m = cibilMeta(c.cibilScore)

                      
return (
                        <Chip
                          size='small'
                          color={m.color}
                          variant='filled'
                          icon={<i className={`${m.icon}`} />}
                          label={`${c.cibilScore} (${m.label})`}
                        />
                      )
                    })()
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>
                  {(() => {
                    const s = sourceMeta(c.source)

                    
return (
                      <Box className='flex items-center gap-1.5'>
                        <i className={`${s.icon} text-lg`} />
                        <span>{s.label}</span>
                      </Box>
                    )
                  })()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box >
  )
}

export default CustomersList
