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

import { useDocumentChecklists } from '@features/document-checklists/hooks/useDocumentChecklists'
import DocumentChecklistsCreateForm from '@features/document-checklists/components/DocumentChecklistsCreateForm'

const DocumentChecklistsList = () => {
    const { documents, loading, search, setSearch, refresh } = useDocumentChecklists()
    const [openAdd, setOpenAdd] = useState(false)
    const [successOpen, setSuccessOpen] = useState(false)

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
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={3}>Loading...</TableCell>
                        </TableRow>
                    ) : documents.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={3}>No documents found</TableCell>
                        </TableRow>
                    ) : (
                        documents.map(d => (
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
                                        {d.name}
                                    </MuiLink>
                                </TableCell>
                                <TableCell>{d.description || '-'}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={d.isActive ? 'Active' : 'Inactive'}
                                        color={d.isActive ? 'success' : 'default'}
                                        variant={d.isActive ? 'filled' : 'outlined'}
                                        size='small'
                                    />
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </Box>
    )
}

export default DocumentChecklistsList
