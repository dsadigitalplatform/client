'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { useSession } from 'next-auth/react'

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

import { useBanks } from '@features/banks/hooks/useBanks'
import BanksCreateForm from '@features/banks/components/BanksCreateForm'
import { migrateBanksFromLeads } from '@features/banks/services/banksService'

const BanksList = () => {
  const { data: session } = useSession()
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
  const { banks, loading, search, setSearch, refresh } = useBanks()
  const [openAdd, setOpenAdd] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  useEffect(() => {
    if (searchParams.get('created') === '1') {
      setSuccessOpen(true)
      router.replace('/banks')
    }
  }, [searchParams, router])

  const handleImportFromLeads = async () => {
    setImporting(true)
    setImportMessage(null)

    try {
      const result = await migrateBanksFromLeads()

      await refresh()
      setImportMessage(
        result.imported > 0
          ? `Imported ${result.imported} bank${result.imported === 1 ? '' : 's'} from leads (${result.skipped} already existed)`
          : result.scanned > 0
            ? 'All lead banks are already in bank master'
            : 'No bank names found in leads'
      )
      setSuccessOpen(true)
    } catch (e: any) {
      setImportMessage(e?.message || 'Failed to import banks from leads')
    } finally {
      setImporting(false)
    }
  }

  const handleExport = () => {
    const rows = [
      ['Code', 'Bank Name', 'Description'],
      ...banks.map(b => [b.code, b.name, b.description ?? ''])
    ]

    const csv = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = 'banks.csv'
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
          <Typography variant='h5'>Banks</Typography>
          <Typography variant='body2' color='text.secondary'>
            Manage bank master records
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
            placeholder='Search by code, bank name or description'
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
              {isSuperAdmin ? (
                <Button
                  variant='outlined'
                  onClick={handleImportFromLeads}
                  disabled={importing}
                  startIcon={<i className='ri-download-2-line' />}
                >
                  {importing ? 'Importing...' : 'Import from Leads'}
                </Button>
              ) : null}
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
              Add a Bank
            </Typography>
            <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add bank'>
              <i className='ri-close-line' />
            </IconButton>
          </Box>
          <BanksCreateForm
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
          Bank added successfully
        </Alert>
      </Snackbar>
      {importMessage ? (
        <Alert severity={importMessage.includes('Failed') ? 'error' : 'info'} onClose={() => setImportMessage(null)}>
          {importMessage}
        </Alert>
      ) : null}
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
          ) : banks.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No banks found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            banks.map(b => (
              <Card
                key={b.id}
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
                      aria-label={`${b.name} avatar`}
                    >
                      {getInitials(b.name)}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <MuiLink
                        component={Link}
                        href={`/banks/${b.id}`}
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
                        {b.name}
                      </MuiLink>
                      <Box className='flex items-center gap-1.5' sx={{ mt: 0.5 }}>
                        <i className='ri-hashtag text-base' />
                        <Typography variant='body2'>{b.code}</Typography>
                      </Box>
                      {b.description ? (
                        <Box className='flex items-start gap-1.5' sx={{ mt: 0.25 }}>
                          <i className='ri-file-text-line text-base' style={{ marginTop: 2 }} />
                          <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                            {b.description}
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
                <TableCell>Code</TableCell>
                <TableCell>Bank Name</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={3}>Loading...</TableCell>
                </TableRow>
              ) : banks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>No banks found</TableCell>
                </TableRow>
              ) : (
                banks.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>
                      <Box className='flex items-center gap-1.5'>
                        <i className='ri-hashtag text-lg' />
                        <span>{b.code}</span>
                      </Box>
                    </TableCell>
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
                          aria-label={`${b.name} avatar`}
                        >
                          {getInitials(b.name)}
                        </Avatar>
                        <MuiLink
                          component={Link}
                          href={`/banks/${b.id}`}
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
                          {b.name}
                        </MuiLink>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280, wordBreak: 'break-word' }}>{b.description || '-'}</TableCell>
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
          aria-label='Add bank'
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

export default BanksList
