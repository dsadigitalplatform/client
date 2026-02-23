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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

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
        <Box className='p-6 flex flex-col gap-4'>
            <Box className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <Box>
                    <Typography variant='h4'>Document Checklist</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Manage required documents and descriptions
                    </Typography>
                </Box>
                <Box className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                    <TextField
                        size='small'
                        placeholder='Search by name'
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <Button variant='contained' onClick={() => setOpenAdd(true)} startIcon={<i className='ri-add-line' />}>
                        Add Document
                    </Button>
                </Box>
            </Box>

            <Drawer anchor='right' open={openAdd} onClose={() => setOpenAdd(false)}>
                <Box className='w-[420px] max-w-full p-6'>
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
                                            backgroundColor: 'transparent',
                                            borderRadius: 1.5
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
        </Box>
    )
}

export default DocumentChecklistsList
