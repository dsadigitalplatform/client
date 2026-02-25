'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
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

import CustomersCreateForm from './CustomersCreateForm'
import { getCustomer, updateCustomer, deleteCustomer } from '@features/customers/services/customersService'

type Props = { id: string }

const CustomerDetails = ({ id }: Props) => {
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

  const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

  const fetchData = async () => {
    setLoading(true)
    const d = await getCustomer(id)

    setData(d)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) return <Typography>Loading...</Typography>
  if (!data) return <Typography>Not found</Typography>

  return (
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
          {!isMobile ? (
            <CardHeader
              title='Customer Details'
              subheader={
                <Box className='flex items-center gap-2'>
                  <Typography component='span' fontWeight={600}>
                    {data.fullName}
                  </Typography>
                  <Chip
                    size='small'
                    label={data.employmentType === 'SALARIED' ? 'Salaried' : 'Self-employed'}
                    variant='outlined'
                    sx={{
                      boxShadow: 'none',
                      backgroundColor:
                        data.employmentType === 'SALARIED'
                          ? 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                          : 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)'
                    }}
                  />
                </Box>
              }
            />
          ) : null}
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            {isMobile ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Button
                  variant='text'
                  onClick={() => router.push('/customers')}
                  startIcon={<i className='ri-arrow-left-line' />}
                  sx={{ minWidth: 'auto', px: 1 }}
                >
                  Back
                </Button>
                <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                  Customer
                </Typography>
                <IconButton color='primary' onClick={() => setEditMode(true)} aria-label='Edit customer'>
                  <i className='ri-pencil-line' />
                </IconButton>
              </Box>
            ) : null}
            {isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                <Avatar sx={{ width: 80, height: 80, bgcolor: 'action.hover', color: 'text.secondary', mb: 1 }}>
                  {String(data.fullName || '')
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((s: string) => s[0]?.toUpperCase())
                    .join('')}
                </Avatar>
                <Typography variant='h6' sx={{ fontWeight: 600 }}>
                  {data.fullName}
                </Typography>
                <Chip
                  size='small'
                  label={data.employmentType === 'SALARIED' ? 'Salaried' : 'Self-employed'}
                  variant='outlined'
                  sx={{
                    mt: 0.75,
                    boxShadow: 'none',
                    backgroundColor:
                      data.employmentType === 'SALARIED'
                        ? 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                        : 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)'
                  }}
                />
              </Box>
            ) : null}
            {isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Box className='flex items-center gap-1.5'>
                  <i className='ri-smartphone-line text-base' />
                  <Typography color='text.secondary'>{data.mobile}</Typography>
                </Box>
                <Box className='flex items-center gap-1.5'>
                  <i className='ri-mail-line text-base' />
                  <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                    {data.email || '-'}
                  </Typography>
                </Box>
                <Box className='flex items-center gap-1.5'>
                  <i className='ri-bank-card-line text-base' />
                  <Typography color='text.secondary'>{data.pan || '-'}</Typography>
                </Box>
                <Box className='flex items-center gap-1.5'>
                  <i className='ri-shield-keyhole-line text-base' />
                  <Typography color='text.secondary'>{data.aadhaarMasked || '-'}</Typography>
                </Box>
                <Box className='flex items-center gap-1.5'>
                  <i className='ri-map-pin-line text-base' />
                  <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                    {data.address || '-'}
                  </Typography>
                </Box>
                <Box className='flex items-center justify-between'>
                  <Typography color='text.secondary'>Income</Typography>
                  <Typography color='text.primary'>
                    {data.monthlyIncome != null ? formatINR(data.monthlyIncome) : '-'}
                  </Typography>
                </Box>
                <Box className='flex items-center justify-between'>
                  <Typography color='text.secondary'>CIBIL</Typography>
                  <Typography color='text.primary'>{data.cibilScore != null ? data.cibilScore : '-'}</Typography>
                </Box>
                <Box className='flex items-center justify-between'>
                  <Typography color='text.secondary'>Source</Typography>
                  <Typography color='text.primary'>{String(data.source).replace('_', ' ')}</Typography>
                </Box>
              </Box>
            ) : (
              <Box className='flex flex-col gap-1'>
                <Typography color='text.secondary'>Mobile: {data.mobile}</Typography>
                <Typography color='text.secondary'>Email: {data.email || '-'}</Typography>
                <Typography color='text.secondary'>PAN: {data.pan || '-'}</Typography>
                <Typography color='text.secondary'>Aadhaar: {data.aadhaarMasked || '-'}</Typography>
                <Typography color='text.secondary'>Address: {data.address || '-'}</Typography>
                <Typography color='text.secondary'>
                  Income: {data.monthlyIncome != null ? formatINR(data.monthlyIncome) : '-'}
                </Typography>
                <Typography color='text.secondary'>CIBIL: {data.cibilScore != null ? data.cibilScore : '-'}</Typography>
                <Typography color='text.secondary'>Source: {String(data.source).replace('_', ' ')}</Typography>
              </Box>
            )}
            <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />
            {isMobile ? (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button variant='contained' fullWidth onClick={() => setEditMode(true)}>
                  Update
                </Button>
                <Button variant='outlined' color='error' fullWidth onClick={() => setConfirmOpen(true)}>
                  Delete
                </Button>
              </Box>
            ) : (
              <Box className='flex gap-2'>
                <Button variant='contained' onClick={() => setEditMode(true)}>
                  Update
                </Button>
                <Button variant='outlined' color='error' onClick={() => setConfirmOpen(true)}>
                  Delete
                </Button>
                <Link href='/customers'>
                  <Button>Back to List</Button>
                </Link>
              </Box>
            )}
          </CardContent>
        </>
      ) : (
        <>
          {!isMobile ? <CardHeader title='Update Customer' /> : null}
          <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
            <CustomersCreateForm
              showTitle={false}
              variant='plain'
              submitLabel='Update Customer'
              initialValues={{
                fullName: data.fullName,
                mobile: data.mobile,
                email: data.email,
                dob: data.dob,
                pan: data.pan,
                aadhaarMasked: data.aadhaarMasked,
                address: data.address,
                employmentType: data.employmentType,
                source: data.source,
                monthlyIncome: data.monthlyIncome,
                cibilScore: data.cibilScore
              }}
              onSubmitOverride={async payload => {
                await updateCustomer(id, payload)
                await fetchData()
                setEditMode(false)
                setToast({ open: true, msg: 'Customer updated', severity: 'success' })
              }}
              onCancel={() => setEditMode(false)}
            />
          </CardContent>
        </>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Customer</DialogTitle>
        <DialogContent>Are you sure you want to delete this customer?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color='error'
            onClick={async () => {
              try {
                await deleteCustomer(id)
                setToast({ open: true, msg: 'Customer deleted', severity: 'success' })
                setConfirmOpen(false)
                router.push('/customers')
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
          icon={<i className='ri-information-line' />}
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
    </Card>
  )
}

export default CustomerDetails
