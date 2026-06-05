'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import MuiLink from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { useAdvocates } from '@features/advocates/hooks/useAdvocates'
import AdvocatesCreateForm from '@features/advocates/components/AdvocatesCreateForm'

const AdvocatesList = () => {
  const { advocates, loading, search, setSearch, refresh } = useAdvocates()
  const [openAdd, setOpenAdd] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      setSuccessOpen(true)
      router.replace('/advocates')
    }
  }, [searchParams, router])

  const handleExport = () => {
    const rows = [
      ['Name', 'Country Code', 'Mobile', 'Email', 'Address'],
      ...advocates.map(a => [a.name, a.countryCode, a.mobile, a.email ?? '', a.address ?? ''])
    ]

    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = 'advocates.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const getInitials = (name: string) =>
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(s => s[0]?.toUpperCase())
      .join('')

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
          <Typography variant='h5'>Advocates</Typography>
          <Typography variant='body2' color='text.secondary'>
            Manage advocate records
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
            sx={{ minWidth: { sm: 350 } }}
            size='small'
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder='Search by name, email, mobile or address'
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
                Add
              </Button>
            </Box>
          )}
        </Box>
      </Box>
      <Drawer anchor='right' open={openAdd} onClose={() => setOpenAdd(false)} keepMounted>
        <Box sx={{ width: { xs: '100vw', sm: 480, md: 520 }, p: 3, '& .MuiTextField-root': { mb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant='h6' color='text.primary'>
              Add an Advocate
            </Typography>
            <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add advocate'>
              <i className='ri-close-line' />
            </IconButton>
          </Box>
          <AdvocatesCreateForm
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
          Advocate added successfully
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
          ) : advocates.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No advocates found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            advocates.map(a => (
              <Card
                key={a.id}
                sx={{
                  borderRadius: 3,
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper'
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: 'primary.light',
                        color: 'primary.contrastText',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        flexShrink: 0
                      }}
                      aria-label={`${a.name} avatar`}
                    >
                      {getInitials(a.name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <MuiLink
                        component={Link}
                        href={`/advocates/${a.id}`}
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
                        {a.name}
                      </MuiLink>
                      <Box className='flex items-center gap-1.5' sx={{ mt: 0.5 }}>
                        <i className='ri-smartphone-line text-base' />
                        <Typography variant='body2'>
                          {[a.countryCode, a.mobile].filter(Boolean).join(' ')}
                        </Typography>
                      </Box>
                      {a.email ? (
                        <Box className='flex items-center gap-1.5' sx={{ mt: 0.25 }}>
                          <i className='ri-mail-line text-base' />
                          <Typography variant='body2' sx={{ wordBreak: 'break-all' }}>
                            {a.email}
                          </Typography>
                        </Box>
                      ) : null}
                      {a.address ? (
                        <Box className='flex items-start gap-1.5' sx={{ mt: 0.25 }}>
                          <i className='ri-map-pin-line text-base' style={{ marginTop: 2 }} />
                          <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                            {a.address}
                          </Typography>
                        </Box>
                      ) : null}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Country Code - Mobile Number</TableCell>
                <TableCell>Email Address</TableCell>
                <TableCell>Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>Loading...</TableCell>
                </TableRow>
              ) : advocates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No advocates found</TableCell>
                </TableRow>
              ) : (
                advocates.map(a => (
                  <TableRow key={a.id}>
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
                          aria-label={`${a.name} avatar`}
                        >
                          {getInitials(a.name)}
                        </Avatar>
                        <MuiLink
                          component={Link}
                          href={`/advocates/${a.id}`}
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
                          {a.name}
                        </MuiLink>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box className='flex items-center gap-1.5'>
                        <i className='ri-smartphone-line text-lg' />
                        <span>{[a.countryCode, a.mobile].filter(Boolean).join(' ')}</span>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box className='flex items-center gap-1.5'>
                        <i className='ri-mail-line text-lg' />
                        <span>{a.email || '-'}</span>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280, wordBreak: 'break-word' }}>{a.address || '-'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Box>
      )}
      {isMobile && !openAdd ? (
        <Fab
          color='primary'
          aria-label='Add advocate'
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
    </Box>
  )
}

export default AdvocatesList
