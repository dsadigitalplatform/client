'use client'

import { useCallback, useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import LoanStatusPipelineCreateForm from '@features/loan-status-pipeline/components/LoanStatusPipelineCreateForm'
import {
  deleteLoanStatusPipelineStage,
  getLoanStatusPipelineStage,
  updateLoanStatusPipelineStage
} from '@features/loan-status-pipeline/services/loanStatusPipelineService'

type Props = { id: string }

const LoanStatusPipelineStageDetails = ({ id }: Props) => {
  const router = useRouter()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success'
  })

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await getLoanStatusPipelineStage(id)

      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    try {
      await deleteLoanStatusPipelineStage(id)

      router.push('/loan-status-pipeline')
    } catch {
      setToast({ open: true, msg: 'Failed to delete stage', severity: 'error' })
    }
  }

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  if (!data) {
    return (
      <Box sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Typography>Stage not found</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Card>
        {!isMobile ? (
          <CardHeader
            title='Stage Details'
            action={
              <Box className='flex gap-2'>
                <Button size='small' variant='text' onClick={() => router.push('/loan-status-pipeline')}>
                  Back to List
                </Button>
                {!editMode ? (
                  <Button size='small' variant='outlined' onClick={() => setEditMode(true)}>
                    Edit
                  </Button>
                ) : null}
                <Button size='small' color='error' variant='outlined' onClick={() => setConfirmOpen(true)}>
                  Delete
                </Button>
              </Box>
            }
          />
        ) : null}
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          {isMobile && !editMode ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Button
                variant='text'
                onClick={() => router.push('/loan-status-pipeline')}
                startIcon={<i className='ri-arrow-left-line' />}
                sx={{ minWidth: 'auto', px: 1 }}
              >
                Back
              </Button>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Stage
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <IconButton color='primary' onClick={() => setEditMode(v => !v)} aria-label='Edit stage'>
                  <i className={editMode ? 'ri-close-line' : 'ri-pencil-line'} />
                </IconButton>
                <IconButton color='error' onClick={() => setConfirmOpen(true)} aria-label='Delete stage'>
                  <i className='ri-delete-bin-6-line' />
                </IconButton>
              </Box>
            </Box>
          ) : null}
          {editMode ? (
            <LoanStatusPipelineCreateForm
              showTitle={false}
              variant='plain'
              redirectOnSuccess
              onCancel={() => setEditMode(false)}
              initialValues={{
                name: data.name,
                description: data.description,
                order: data.order
              }}
              submitLabel='Update Stage'
              onSubmitOverride={async payload => {
                await updateLoanStatusPipelineStage(id, payload)
              }}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant='h6' sx={{ fontWeight: 700 }}>
                  {data.name}
                </Typography>
                <Chip
                  label={`Stage ${data.order}`}
                  size='small'
                  variant='outlined'
                  sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)' }}
                />
              </Box>
              <Box>
                <Typography variant='subtitle2' color='text.secondary'>
                  Description
                </Typography>
                <Typography variant='body2' sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                  {data.description || '-'}
                </Typography>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Stage</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>Are you sure you want to delete this stage?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color='error' variant='contained' onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast(v => ({ ...v, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert
          onClose={() => setToast(v => ({ ...v, open: false }))}
          severity={toast.severity}
          variant='filled'
          icon={<i className={toast.severity === 'success' ? 'ri-checkbox-circle-line' : 'ri-error-warning-line'} />}
          sx={{
            width: '100%',
            color: 'text.primary',
            backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor:
              toast.severity === 'success'
                ? 'rgb(var(--mui-palette-success-mainChannel) / 0.4)'
                : 'rgb(var(--mui-palette-error-mainChannel) / 0.4)',
            boxShadow: '0 12px 30px rgb(0 0 0 / 0.12)',
            '& .MuiAlert-icon': {
              color: toast.severity === 'success' ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-error-main)'
            }
          }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default LoanStatusPipelineStageDetails
