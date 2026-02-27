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

import { useDocumentChecklists } from '@features/document-checklists/hooks/useDocumentChecklists'
import DocumentChecklistsCreateForm from '@features/document-checklists/components/DocumentChecklistsCreateForm'
import { deleteDocumentChecklist } from '@features/document-checklists/services/documentChecklistsService'

const getChecklistIcon = (name: string) => {
    const value = name.toLowerCase()

    if (value.includes('aadhaar') || value.includes('passport') || value.includes('identity') || value.includes('id')) {
        return { icon: 'ri-id-card-line', color: 'primary.main' }
    }

    if (value.includes('address') || value.includes('residence') || value.includes('utility')) {
        return { icon: 'ri-map-pin-line', color: 'info.main' }
    }

    if (value.includes('income') || value.includes('salary') || value.includes('bank') || value.includes('statement')) {
        return { icon: 'ri-money-dollar-circle-line', color: 'success.main' }
    }

    if (value.includes('photo') || value.includes('selfie') || value.includes('image')) {
        return { icon: 'ri-image-line', color: 'secondary.main' }
    }

    if (value.includes('signature')) {
        return { icon: 'ri-pen-nib-line', color: 'warning.main' }
    }

    if (value.includes('property') || value.includes('title') || value.includes('deed')) {
        return { icon: 'ri-home-4-line', color: 'primary.main' }
    }

    if (value.includes('vehicle') || value.includes('rc')) {
        return { icon: 'ri-car-line', color: 'warning.main' }
    }

    if (value.includes('business') || value.includes('gst') || value.includes('trade')) {
        return { icon: 'ri-briefcase-3-line', color: 'secondary.main' }
    }

    if (value.includes('education') || value.includes('student') || value.includes('study')) {
        return { icon: 'ri-graduation-cap-line', color: 'info.main' }
    }

    if (value.includes('medical') || value.includes('health')) {
        return { icon: 'ri-heart-pulse-line', color: 'error.main' }
    }

    if (value.includes('insurance')) {
        return { icon: 'ri-shield-check-line', color: 'primary.main' }
    }

    return { icon: 'ri-file-text-line', color: 'text.secondary' }
}

const DocumentChecklistsList = () => {
    const { documents, loading, search, setSearch, refresh } = useDocumentChecklists()
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
            await deleteDocumentChecklist(deleteTarget.id)
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
                    <Typography variant='h5'>Document Checklist</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Manage required documents and descriptions
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, alignItems: { sm: 'center' }, flex: 1 }}>
                    <TextField
                        size='small'
                        placeholder='Search by name'
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
                        <Typography variant='h6'>New Document</Typography>
                        <IconButton onClick={() => setOpenAdd(false)} aria-label='Close add document'>
                            <i className='ri-close-line' />
                        </IconButton>
                    </Box>
                    <DocumentChecklistsCreateForm
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
                    Document added successfully
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
                    ) : documents.length === 0 ? (
                        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                            <CardContent sx={{ p: 2 }}>
                                <Typography variant='body2' color='text.secondary'>
                                    No documents found
                                </Typography>
                            </CardContent>
                        </Card>
                    ) : (
                        documents.map(d => {
                            const iconMeta = getChecklistIcon(d.name)

                            return (
                                <Card
                                    key={d.id}
                                    sx={{
                                        borderRadius: 3,
                                        boxShadow: 'none',
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        backgroundColor: 'background.paper'
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
                                                    href={`/document-checklists/${d.id}`}
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
                                                    {d.name}
                                                </MuiLink>
                                                <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                                                    {d.description || '-'}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={d.isActive ? 'Active' : 'Inactive'}
                                                color={d.isActive ? 'success' : 'default'}
                                                size='small'
                                                variant='outlined'
                                                sx={{
                                                    boxShadow: 'none',
                                                    backgroundColor: d.isActive
                                                        ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                                        : 'rgb(var(--mui-palette-text-primaryChannel) / 0.06)'
                                                }}
                                            />
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            <IconButton
                                                color='error'
                                                onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
                                                aria-label={`Delete ${d.name}`}
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
                            <TableCell>Name</TableCell>
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
                        ) : documents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4}>No documents found</TableCell>
                            </TableRow>
                        ) : (
                            documents.map(d => {
                                const iconMeta = getChecklistIcon(d.name)

                                return (
                                    <TableRow key={d.id}>
                                        <TableCell>
                                            <MuiLink
                                                component={Link}
                                                href={`/document-checklists/${d.id}`}
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
                                                    <span>{d.name}</span>
                                                </Box>
                                            </MuiLink>
                                        </TableCell>
                                        <TableCell>{d.description || '-'}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={d.isActive ? 'Active' : 'Inactive'}
                                                color={d.isActive ? 'success' : 'default'}
                                                variant='outlined'
                                                size='small'
                                                sx={{
                                                    boxShadow: 'none',
                                                    backgroundColor: d.isActive
                                                        ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                                        : 'rgb(var(--mui-palette-text-primaryChannel) / 0.06)'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align='right'>
                                            <Button
                                                size='small'
                                                color='error'
                                                variant='outlined'
                                                onClick={() => setDeleteTarget({ id: d.id, name: d.name })}
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
                <DialogTitle>Delete Document</DialogTitle>
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
                    aria-label='Add document'
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

export default DocumentChecklistsList
