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
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Fab from '@mui/material/Fab'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { useCustomers } from '@features/customers/hooks/useCustomers'
import CustomersCreateForm from '@features/customers/components/CustomersCreateForm'

const CustomersList = () => {
  const { customers, loading, search, setSearch, refresh } = useCustomers()
  const [openAdd, setOpenAdd] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

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

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          gap: 2,
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          <Typography variant='h5'>Customers</Typography>
          <Typography variant='body2' color='text.secondary'>
            Manage customer records
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            alignItems: { sm: 'center' },
            flex: 1
          }}
        >
          <TextField
            size='small'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by name, email or mobile'
            onKeyDown={e => {
              if (e.key === 'Enter') refresh()
            }}
            fullWidth={isMobile}
          />
          {isMobile ? null : (
            <Button variant='contained' onClick={refresh} sx={{ minWidth: 110 }}>
              Search
            </Button>
          )}
          {isMobile ? null : (
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
              <Button variant='outlined' onClick={handleExport} startIcon={<i className='ri-download-line' />}>
                Export
              </Button>
              <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={() => setOpenAdd(true)}>
                Add Customer
              </Button>
            </Box>
          )}
        </Box>
      </Box>
      <Drawer anchor='right' open={openAdd} onClose={() => setOpenAdd(false)} keepMounted>
        <Box sx={{ width: { xs: '100vw', sm: 480, md: 520 }, p: 3, '& .MuiTextField-root': { mb: 1.5 } }}>
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
            color: 'text.primary',
            backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'rgb(var(--mui-palette-success-mainChannel) / 0.4)',
            boxShadow: '0 12px 30px rgb(0 0 0 / 0.12)',
            '& .MuiAlert-icon': {
              color: 'var(--mui-palette-success-main)'
            }
          }}
        >
          Customer added successfully
        </Alert>
      </Snackbar>
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  Loading...
                </Typography>
              </CardContent>
            </Card>
          ) : customers.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No customers found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            customers.map(c => {
              return (
                <Card
                  key={c.id}
                  sx={{
                    borderRadius: 3,
                    boxShadow: 'none',
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper'
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
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
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <MuiLink
                          component={Link}
                          href={`/customers/${c.id}`}
                          underline='hover'
                          color='text.primary'
                          sx={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            display: 'block',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            transition: 'color .2s ease',
                            '&:hover': {
                              color: 'primary.main'
                            }
                          }}
                        >
                          {c.fullName}
                        </MuiLink>
                        <Box className='flex items-center gap-1.5'>
                          <i className='ri-smartphone-line text-base' />
                          <Typography variant='body2'>{c.mobile}</Typography>
                        </Box>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.25 }}>
                      <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                        {c.email || '-'}
                      </Typography>
                      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                        <Chip
                          label={c.monthlyIncome != null ? formatINR(c.monthlyIncome) : '-'}
                          size='small'
                          variant='outlined'
                          sx={{
                            boxShadow: 'none',
                            backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                          }}
                        />
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )
            })
          )}
        </Box>
      ) : (
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
                          transition: 'color .2s ease',
                          '&:hover': {
                            color: 'primary.main'
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
                      variant='outlined'
                      sx={{
                        boxShadow: 'none',
                        backgroundColor:
                          c.employmentType === 'SALARIED'
                            ? 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                            : 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)'
                      }}
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
                            variant='outlined'
                            icon={<i className={`${m.icon}`} />}
                            label={`${c.cibilScore} (${m.label})`}
                            sx={{
                              boxShadow: 'none',
                              backgroundColor:
                                m.color === 'success'
                                  ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                  : m.color === 'warning'
                                    ? 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)'
                                    : 'rgb(var(--mui-palette-error-mainChannel) / 0.08)'
                            }}
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
      )}
      {isMobile && !openAdd ? (
        <Fab
          color='primary'
          aria-label='Add customer'
          onClick={() => setOpenAdd(true)}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 20,
            zIndex: theme.zIndex.drawer + 1,
            boxShadow: '0 14px 30px rgb(0 0 0 / 0.2)'
          }}
        >
          <i className='ri-add-line text-2xl' />
        </Fab>
      ) : null}
    </Box >
  )
}

export default CustomersList
