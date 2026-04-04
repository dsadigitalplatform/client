'use client'

import { useCallback, useEffect, useState } from 'react'

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

import AssociatesCreateForm from './AssociatesCreateForm'
import { getAssociate, updateAssociate, deleteAssociate } from '@features/associates/services/associatesService'

type Props = { id: string }

const AssociateDetails = ({ id }: Props) => {
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

    const fetchData = useCallback(async () => {
        setLoading(true)
        const d = await getAssociate(id)

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
                        {!isMobile ? <CardHeader title='Associate Details' /> : null}
                        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                            {isMobile ? (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Button
                                        variant='text'
                                        onClick={() => router.push('/associates')}
                                        startIcon={<i className='ri-arrow-left-line' />}
                                        sx={{ minWidth: 'auto', px: 1 }}
                                    >
                                        Back
                                    </Button>
                                    <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                                        Associate
                                    </Typography>
                                    {canManage ? (
                                        <IconButton color='primary' onClick={() => setEditMode(true)} aria-label='Edit associate'>
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
                                        {String(data.associateName || '')
                                            .split(' ')
                                            .filter(Boolean)
                                            .slice(0, 2)
                                            .map((s: string) => s[0]?.toUpperCase())
                                            .join('')}
                                    </Avatar>
                                    <Typography variant='h6' sx={{ fontWeight: 600 }}>
                                        {data.associateName}
                                    </Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {data.companyName || '-'}
                                    </Typography>
                                    <Typography variant='body2' color='text.secondary'>
                                        {data.associateTypeName || '-'}
                                    </Typography>
                                    <Chip
                                        size='small'
                                        label={data.isActive ? 'Active' : 'Inactive'}
                                        variant='outlined'
                                        sx={{
                                            mt: 0.75,
                                            boxShadow: 'none',
                                            borderColor: data.isActive
                                                ? 'rgb(var(--mui-palette-success-mainChannel) / 0.5)'
                                                : 'rgb(var(--mui-palette-error-mainChannel) / 0.5)',
                                            color: data.isActive ? 'success.main' : 'error.main',
                                            backgroundColor: data.isActive
                                                ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                                : 'rgb(var(--mui-palette-error-mainChannel) / 0.08)'
                                        }}
                                    />
                                </Box>
                            ) : null}
                            {isMobile ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                                    <Box className='flex items-center gap-1.5'>
                                        <i className='ri-smartphone-line text-base' />
                                        <Typography color='text.secondary'>
                                            {[data.countryCode, data.mobile].filter(Boolean).join(' ')}
                                        </Typography>
                                    </Box>
                                    <Box className='flex items-center gap-1.5'>
                                        <i className='ri-mail-line text-base' />
                                        <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                                            {data.email || '-'}
                                        </Typography>
                                    </Box>
                                    <Box className='flex items-center gap-1.5'>
                                        <i className='ri-team-line text-base' />
                                        <Typography color='text.secondary'>{data.associateTypeName || '-'}</Typography>
                                    </Box>
                                    <Box className='flex items-center gap-1.5'>
                                        <i className='ri-percent-line text-base' />
                                        <Typography color='text.secondary'>{data.payout != null ? `${data.payout}%` : '-'}</Typography>
                                    </Box>
                                    <Box className='flex items-center gap-1.5'>
                                        <i className='ri-hashtag text-base' />
                                        <Typography color='text.secondary'>{data.code || '-'}</Typography>
                                    </Box>
                                    <Box className='flex items-center gap-1.5'>
                                        <i className='ri-bank-card-line text-base' />
                                        <Typography color='text.secondary'>{data.pan || '-'}</Typography>
                                    </Box>
                                </Box>
                            ) : (
                                <Box className='flex flex-col gap-1'>
                                    <Typography color='text.secondary'>Company: {data.companyName || '-'}</Typography>
                                    <Typography color='text.secondary'>Associate Type: {data.associateTypeName || '-'}</Typography>
                                    <Typography color='text.secondary'>
                                        Mobile: {[data.countryCode, data.mobile].filter(Boolean).join(' ')}
                                    </Typography>
                                    <Typography color='text.secondary'>Email: {data.email || '-'}</Typography>
                                    <Typography color='text.secondary'>Payout: {data.payout != null ? `${data.payout}%` : '-'}</Typography>
                                    <Typography color='text.secondary'>Code: {data.code || '-'}</Typography>
                                    <Typography color='text.secondary'>PAN: {data.pan || '-'}</Typography>
                                    <Typography color='text.secondary'>Status: {data.isActive ? 'Active' : 'Inactive'}</Typography>
                                </Box>
                            )}
                            <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />
                            {isMobile ? (
                                <Box sx={{ display: 'flex', gap: 1.5 }}>
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
                                        <Button fullWidth onClick={() => router.push('/associates')}>
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
                                    <Link href='/associates'>
                                        <Button>Back to List</Button>
                                    </Link>
                                </Box>
                            )}
                        </CardContent>
                    </>
                ) : (
                    <>
                        {!isMobile ? <CardHeader title='Update Associate' /> : null}
                        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
                            <AssociatesCreateForm
                                showTitle={false}
                                variant='plain'
                                submitLabel='Update Associate'
                                redirectOnSuccess
                                initialValues={{
                                    associateName: data.associateName,
                                    companyName: data.companyName,
                                    associateTypeId: data.associateTypeId,
                                    countryCode: data.countryCode,
                                    mobile: data.mobile,
                                    email: data.email,
                                    payout: data.payout,
                                    code: data.code,
                                    pan: data.pan,
                                    isActive: data.isActive
                                }}
                                onSubmitOverride={async payload => {
                                    await updateAssociate(id, payload)
                                }}
                                onSuccess={() => {
                                    fetchData()
                                    setEditMode(false)
                                }}
                                onCancel={() => setEditMode(false)}
                            />
                        </CardContent>
                    </>
                )}
            </Card>

            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
                <DialogTitle>Delete Associate</DialogTitle>
                <DialogContent>Are you sure you want to delete this associate?</DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button
                        color='error'
                        onClick={async () => {
                            try {
                                await deleteAssociate(id)
                                setToast({ open: true, msg: 'Associate deleted', severity: 'success' })
                                setConfirmOpen(false)
                                router.push('/associates')
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
        </Box>
    )
}

export default AssociateDetails
