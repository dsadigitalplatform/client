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

import { useAssociateTypes } from '@features/associate-types/hooks/useAssociateTypes'
import AssociateTypesCreateForm from '@features/associate-types/components/AssociateTypesCreateForm'
import { deleteAssociateType } from '@features/associate-types/services/associateTypesService'

const getAssociateTypeIcon = () => ({ icon: 'ri-team-line', color: 'primary.main' })

const statusMeta = (isActive: boolean) => ({
    label: isActive ? 'Active' : 'Inactive',
    color: (isActive ? 'success' : 'error') as 'success' | 'error',
    backgroundColor: isActive
        ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
        : 'rgb(var(--mui-palette-error-mainChannel) / 0.08)'
})

const AssociateTypesList = () => {
    const { associateTypes, loading, search, setSearch, refresh } = useAssociateTypes()
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
            await deleteAssociateType(deleteTarget.id)
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
                    <Typography variant='h5'>Associate Types</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Manage associate types and descriptions
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'center' }, flex: 1 }}>
                    <TextField
                        size='small'
                        placeholder='Search by associate type'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
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
                        <Typography variant='h6'>New Associate Type</Typography>
                        <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add associate type'>
                            <i className='ri-close-line' />
                        </IconButton>
                    </Box>
                    <AssociateTypesCreateForm
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
                    Associate type added successfully
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
                    ) : associateTypes.length === 0 ? (
                        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant='body2' color='text.secondary'>
                                    No associate types found
                                </Typography>
                            </CardContent>
                        </Card>
                    ) : (
                        associateTypes.map(a => {
                            const iconMeta = getAssociateTypeIcon()

                            return (
                                <Card
                                    key={a.id}
                                    sx={{
                                        borderRadius: 3,
                                        boxShadow: 'none',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        backgroundColor: a.isActive
                                            ? 'background.paper'
                                            : 'rgb(var(--mui-palette-error-mainChannel) / 0.04)'
                                    }}
                                >
                                    <CardContent sx={{ p: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25 }}>
                                            <Avatar
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    bgcolor: 'action.hover',
                                                    color: iconMeta.color
                                                }}
                                            >
                                                <i className={`${iconMeta.icon} text-lg`} aria-hidden='true' />
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <MuiLink
                                                    component={Link}
                                                    href={`/associate-types/${a.id}`}
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
                                                <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                                                    {a.description || '-'}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={statusMeta(a.isActive).label}
                                                color={statusMeta(a.isActive).color}
                                                size='small'
                                                variant='outlined'
                                                sx={{
                                                    boxShadow: 'none',
                                                    backgroundColor: statusMeta(a.isActive).backgroundColor
                                                }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            <IconButton
                                                color='error'
                                                onClick={() => setDeleteTarget({ id: a.id, name: a.name })}
                                                aria-label={`Delete ${a.name}`}
                                            >
                                                <i className='ri-delete-bin-6-line' />
                                            </IconButton>
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
                            <TableCell>Associate Type</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align='right'>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4}>Loading...</TableCell>
                            </TableRow>
                        ) : associateTypes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4}>No associate types found</TableCell>
                            </TableRow>
                        ) : (
                            associateTypes.map(a => {
                                const iconMeta = getAssociateTypeIcon()

                                return (
                                    <TableRow key={a.id}>
                                        <TableCell>
                                            <MuiLink
                                                component={Link}
                                                href={`/associate-types/${a.id}`}
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
                                                <Box className='inline-flex items-center gap-2'>
                                                    <Box component='span' sx={{ color: iconMeta.color, display: 'inline-flex' }}>
                                                        <i className={`${iconMeta.icon} text-base`} aria-hidden='true' />
                                                    </Box>
                                                    <span>{a.name}</span>
                                                </Box>
                                            </MuiLink>
                                        </TableCell>
                                        <TableCell>{a.description || '-'}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={statusMeta(a.isActive).label}
                                                color={statusMeta(a.isActive).color}
                                                size='small'
                                                variant='outlined'
                                                sx={{
                                                    boxShadow: 'none',
                                                    backgroundColor: statusMeta(a.isActive).backgroundColor
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align='right'>
                                            <Button
                                                size='small'
                                                color='error'
                                                variant='outlined'
                                                onClick={() => setDeleteTarget({ id: a.id, name: a.name })}
                                            >
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
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
                <DialogTitle>Delete Associate Type</DialogTitle>
                <DialogContent>
                    <Typography variant='body2'>
                        Are you sure you want to delete {deleteTarget?.name}?
                    </Typography>
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
                    aria-label='Add associate type'
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

export default AssociateTypesList
