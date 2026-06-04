'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
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
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import BanksCreateForm from './BanksCreateForm'
import { getBank, updateBank, deleteBank } from '@features/banks/services/banksService'

type Props = { id: string }

const BankDetails = ({ id }: Props) => {
  const router = useRouter()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success'
  })

  const [confirmOpen, setConfirmOpen] = useState(false)

  const bankEditInitialValues = useMemo(
    () =>
      data
        ? {
            code: data.code,
            name: data.name,
            description: data.description
          }
        : null,
    [data]
  )

  const fetchData = useCallback(async () => {
    setLoading(true)
    const d = await getBank(id)

    setData(d)
    setLoading(false)
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!editMode) return
    fetchData()
  }, [editMode, fetchData])

  if (loading) return <Typography>Loading...</Typography>
  if (!data) return <Typography>Not found</Typography>
  const canManage = Boolean(data?.canManage)

  const getInitials = (name: string) =>
    String(name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0]?.toUpperCase())
      .join('')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card
        sx={{
          borderRadius: { xs: 4, sm: 3 },
          boxShadow: isMobile ? 'none' : 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))',
          border: isMobile ? '1px solid' : 'none',
          borderColor: isMobile ? 'divider' : 'transparent'
        }}
      >
        {!editMode ? (
          <>
            {!isMobile ? <CardHeader title='Bank Details' /> : null}
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              {isMobile ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Button
                    variant='text'
                    onClick={() => router.push('/banks')}
                    startIcon={<i className='ri-arrow-left-line' />}
                    sx={{ minWidth: 'auto', px: 1 }}
                  >
                    Back
                  </Button>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                    Bank
                  </Typography>
                  {canManage ? (
                    <IconButton color='primary' onClick={() => setEditMode(true)} aria-label='Edit bank'>
                      <i className='ri-pencil-line' />
                    </IconButton>
                  ) : (
                    <Box sx={{ width: 40, height: 40 }} />
                  )}
                </Box>
              ) : null}
              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: 'action.hover', color: 'text.secondary', mb: 1 }}>
                    {getInitials(data.name)}
                  </Avatar>
                  <Typography variant='h6' sx={{ fontWeight: 600, textAlign: 'center' }}>
                    {data.name}
                  </Typography>
                </Box>
              ) : null}
              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-hashtag text-base' />
                    <Typography color='text.secondary'>{data.code || '-'}</Typography>
                  </Box>
                  <Box className='flex items-start gap-1.5'>
                    <i className='ri-file-text-line text-base' style={{ marginTop: 2 }} />
                    <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                      {data.description || '-'}
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box className='flex flex-col gap-1'>
                  <Typography color='text.secondary'>Code: {data.code || '-'}</Typography>
                  <Typography color='text.secondary'>Bank Name: {data.name || '-'}</Typography>
                  <Typography color='text.secondary'>Description: {data.description || '-'}</Typography>
                </Box>
              )}
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />
              {isMobile ? (
                <Box sx={{ display: 'flex', gap: 1.5, flexDirection: 'column' }}>
                  {canManage ? (
                    <>
                      <Button variant='contained' fullWidth onClick={() => setEditMode(true)}>
                        Update
                      </Button>
                      <Button variant='outlined' color='error' fullWidth onClick={() => setConfirmOpen(true)}>
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button fullWidth onClick={() => router.push('/banks')}>
                      Back to List
                    </Button>
                  )}
                </Box>
              ) : (
                <Box className='flex gap-2'>
                  {canManage ? (
                    <>
                      <Button variant='contained' onClick={() => setEditMode(true)}>
                        Update
                      </Button>
                      <Button variant='outlined' color='error' onClick={() => setConfirmOpen(true)}>
                        Delete
                      </Button>
                    </>
                  ) : null}
                  <Link href='/banks'>
                    <Button>Back to List</Button>
                  </Link>
                </Box>
              )}
            </CardContent>
          </>
        ) : (
          <>
            {!isMobile ? <CardHeader title='Update Bank' /> : null}
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <BanksCreateForm
                showTitle={false}
                variant='plain'
                submitLabel='Update Bank'
                redirectOnSuccess
                initialValues={bankEditInitialValues ?? undefined}
                onSubmitOverride={async payload => {
                  await updateBank(id, payload)
                }}
                onSuccess={() => {
                  fetchData()
                  setEditMode(false)
                  setToast({ open: true, msg: 'Bank updated successfully', severity: 'success' })
                }}
                onCancel={() => setEditMode(false)}
              />
            </CardContent>
          </>
        )}
      </Card>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth={isMobile}>
        <DialogTitle>Delete Bank</DialogTitle>
        <DialogContent>Are you sure you want to delete this bank?</DialogContent>
        <DialogActions sx={{ flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: { xs: 1, sm: 0 }, px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} fullWidth={isMobile}>
            Cancel
          </Button>
          <Button
            color='error'
            variant='contained'
            fullWidth={isMobile}
            onClick={async () => {
              try {
                await deleteBank(id)
                setToast({ open: true, msg: 'Bank deleted', severity: 'success' })
                setConfirmOpen(false)
                router.push('/banks')
              } catch {
                setToast({ open: true, msg: 'Failed to delete', severity: 'error' })
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(v => ({ ...v, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast(v => ({ ...v, open: false }))}
          severity={toast.severity}
          variant='filled'
          icon={
            toast.severity === 'success' ? (
              <i className='ri-checkbox-circle-line' />
            ) : (
              <i className='ri-close-circle-line' />
            )
          }
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

export default BankDetails
