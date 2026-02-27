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
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Avatar from '@mui/material/Avatar'
import Fab from '@mui/material/Fab'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import { useLoanStatusPipeline } from '@features/loan-status-pipeline/hooks/useLoanStatusPipeline'
import LoanStatusPipelineCreateForm from '@features/loan-status-pipeline/components/LoanStatusPipelineCreateForm'
import { deleteLoanStatusPipelineStage } from '@features/loan-status-pipeline/services/loanStatusPipelineService'

const LoanStatusPipelineList = () => {
  const { stages, loading, search, setSearch, refresh } = useLoanStatusPipeline()
  const [openAdd, setOpenAdd] = useState(false)
  const [successOpen, setSuccessOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)

    try {
      await deleteLoanStatusPipelineStage(deleteTarget.id)
      setDeleteTarget(null)
      refresh()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box sx={{ mx: { xs: -2, sm: 0 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
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
          <Typography variant='h5'>Loan Status Pipeline</Typography>
          <Typography variant='body2' color='text.secondary'>
            Manage loan stages and their stage number
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'center' }, flex: 1 }}>
          <TextField
            size='small'
            placeholder='Search by stage name'
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') refresh()
            }}
            fullWidth={isMobile}
          />
          {isMobile ? null : (
            <Button variant='contained' onClick={() => setOpenAdd(true)} startIcon={<i className='ri-add-line' />}>
              Add
            </Button>
          )}
        </Box>
      </Box>

      <Drawer anchor='right' open={openAdd} onClose={() => setOpenAdd(false)} keepMounted>
        <Box sx={{ width: { xs: '100vw', sm: 420 }, p: 3 }}>
          <Box className='flex items-center justify-between mb-4'>
            <Typography variant='h6'>New Stage</Typography>
            <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add stage'>
              <i className='ri-close-line' />
            </IconButton>
          </Box>
          <LoanStatusPipelineCreateForm
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

      <Snackbar open={successOpen} autoHideDuration={3000} onClose={() => setSuccessOpen(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
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
            '& .MuiAlert-icon': { color: 'var(--mui-palette-success-main)' }
          }}
        >
          Stage added successfully
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
          ) : stages.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No stages found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            stages.map(s => (
              <Card
                key={s.id}
                sx={{
                  borderRadius: 3,
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper'
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.25 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'text.secondary' }}>
                      <i className='ri-flow-chart text-lg' aria-hidden='true' />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <MuiLink
                        component={Link}
                        href={`/loan-status-pipeline/${s.id}`}
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
                          '&:hover': { color: 'primary.main' }
                        }}
                      >
                        {s.name}
                      </MuiLink>
                      <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                        {s.description || '-'}
                      </Typography>
                    </Box>
                    <Chip
                      label={`Stage ${s.order}`}
                      size='small'
                      variant='outlined'
                      sx={{
                        boxShadow: 'none',
                        backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <IconButton color='error' onClick={() => setDeleteTarget({ id: s.id, name: s.name })} aria-label={`Delete ${s.name}`}>
                      <i className='ri-delete-bin-6-line' />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Stage</TableCell>
              <TableCell>Stage Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4}>Loading...</TableCell>
              </TableRow>
            ) : stages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4}>No stages found</TableCell>
              </TableRow>
            ) : (
              stages.map(s => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Chip
                      label={s.order}
                      size='small'
                      variant='outlined'
                      sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)' }}
                    />
                  </TableCell>
                  <TableCell>
                    <MuiLink
                      component={Link}
                      href={`/loan-status-pipeline/${s.id}`}
                      underline='hover'
                      color='text.primary'
                      sx={{ fontSize: '0.95rem', fontWeight: 500, transition: 'color .2s ease', '&:hover': { color: 'primary.main' } }}
                    >
                      <Box className='inline-flex items-center gap-2'>
                        <Box component='span' sx={{ color: 'text.secondary', display: 'inline-flex' }}>
                          <i className='ri-flow-chart text-base' aria-hidden='true' />
                        </Box>
                        <span>{s.name}</span>
                      </Box>
                    </MuiLink>
                  </TableCell>
                  <TableCell>{s.description || '-'}</TableCell>
                  <TableCell align='right'>
                    <Button size='small' color='error' variant='outlined' onClick={() => setDeleteTarget({ id: s.id, name: s.name })}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (deleting) return
          setDeleteTarget(null)
        }}
      >
        <DialogTitle>Delete Stage</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>Are you sure you want to delete {deleteTarget?.name}?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {isMobile && !openAdd ? (
        <Fab
          color='primary'
          aria-label='Add stage'
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

export default LoanStatusPipelineList
