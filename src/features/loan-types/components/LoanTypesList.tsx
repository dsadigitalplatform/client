'use client'

import { useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Checkbox from '@mui/material/Checkbox'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

import { useLoanTypes } from '@features/loan-types/hooks/useLoanTypes'
import LoanTypesCreateForm from '@features/loan-types/components/LoanTypesCreateForm'
import { deleteLoanType, getLoanTypeDocuments, updateLoanTypeDocuments } from '@features/loan-types/services/loanTypesService'
import type {
    LoanTypeDocumentItem,
    LoanTypeDocumentMapping,
    LoanTypeDocumentStatus
} from '@features/loan-types/loan-types.types'

const STATUS_OPTIONS: Array<{ value: LoanTypeDocumentStatus; label: string }> = [
    { value: 'REQUIRED', label: 'Required' },
    { value: 'OPTIONAL', label: 'Optional' },
    { value: 'INACTIVE', label: 'Inactive' }
]

const getLoanTypeIcon = (name: string) => {
    const value = name.toLowerCase()

    if (value.includes('home') || value.includes('house') || value.includes('mortgage')) {
        return { icon: 'ri-home-4-line', color: 'primary.main' }
    }

    if (value.includes('auto') || value.includes('vehicle') || value.includes('car')) {
        return { icon: 'ri-car-line', color: 'warning.main' }
    }

    if (value.includes('education') || value.includes('student') || value.includes('study')) {
        return { icon: 'ri-graduation-cap-line', color: 'info.main' }
    }

    if (value.includes('business') || value.includes('enterprise') || value.includes('trade')) {
        return { icon: 'ri-briefcase-3-line', color: 'secondary.main' }
    }

    if (value.includes('gold') || value.includes('jewel') || value.includes('ornament')) {
        return { icon: 'ri-vip-diamond-line', color: 'warning.main' }
    }

    if (value.includes('agri') || value.includes('farm') || value.includes('kisan')) {
        return { icon: 'ri-plant-line', color: 'success.main' }
    }

    if (value.includes('medical') || value.includes('health')) {
        return { icon: 'ri-heart-pulse-line', color: 'error.main' }
    }

    if (value.includes('credit') || value.includes('card')) {
        return { icon: 'ri-bank-card-line', color: 'primary.main' }
    }

    if (value.includes('personal') || value.includes('consumer')) {
        return { icon: 'ri-user-line', color: 'info.main' }
    }

    return { icon: 'ri-file-list-3-line', color: 'text.secondary' }
}

const LoanTypesList = () => {
    const router = useRouter()
    const { loanTypes, loading, search, setSearch, refresh } = useLoanTypes()
    const [openAdd, setOpenAdd] = useState(false)
    const [lastCreatedId, setLastCreatedId] = useState<string | null>(null)
    const [successOpen, setSuccessOpen] = useState(false)
    const [saved, setSaved] = useState(false)
    const [confirmId, setConfirmId] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)
    const [mappingLoanType, setMappingLoanType] = useState<{ id: string; name: string } | null>(null)
    const [mappingDocs, setMappingDocs] = useState<LoanTypeDocumentItem[]>([])
    const [mappingSelections, setMappingSelections] = useState<LoanTypeDocumentMapping[]>([])
    const [mappingLoading, setMappingLoading] = useState(false)
    const [mappingSaving, setMappingSaving] = useState(false)
    const [mappingError, setMappingError] = useState<string | null>(null)

    const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
        open: false,
        msg: '',
        severity: 'success'
    })

    const resetDrawer = () => {
        setOpenAdd(false)
        setLastCreatedId(null)
        setSuccessOpen(false)
        setSaved(false)
    }

    const confirmDelete = async () => {
        if (!confirmId) return
        setDeleting(true)

        try {
            await deleteLoanType(confirmId)
            setToast({ open: true, msg: 'Loan type deleted', severity: 'success' })
            setConfirmId(null)
            await refresh()
        } catch {
            setToast({ open: true, msg: 'Failed to delete loan type', severity: 'error' })
        } finally {
            setDeleting(false)
        }
    }

    const openMapping = async (id: string, name: string) => {
        setMappingOpen(true)
        setMappingLoanType({ id, name })
        setMappingLoading(true)
        setMappingError(null)

        try {
            const data = await getLoanTypeDocuments(id)

            setMappingDocs((data as any)?.documents ?? [])
            setMappingSelections((data as any)?.mappings ?? [])
        } catch {
            setMappingError('Failed to load checklists')
        } finally {
            setMappingLoading(false)
        }
    }

    const toggleMapping = (documentId: string) => {
        setMappingSelections(prev => {
            if (prev.some(m => m.documentId === documentId)) {
                return prev.filter(m => m.documentId !== documentId)
            }

            return [...prev, { documentId, status: 'REQUIRED' }]
        })
    }

    const updateMappingStatus = (documentId: string, status: LoanTypeDocumentStatus) => {
        setMappingSelections(prev => prev.map(m => (m.documentId === documentId ? { ...m, status } : m)))
    }

    const saveMappings = async () => {
        if (!mappingLoanType) return
        setMappingSaving(true)
        setMappingError(null)

        try {
            await updateLoanTypeDocuments(mappingLoanType.id, mappingSelections)
            setToast({ open: true, msg: 'Checklists updated', severity: 'success' })
            setMappingOpen(false)
            await refresh()
        } catch (e: any) {
            setMappingError(e?.message || 'Failed to update checklists')
        } finally {
            setMappingSaving(false)
        }
    }

    return (
        <Box className='p-6 flex flex-col gap-4'>
            <Box className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
                <Box>
                    <Typography variant='h4'>Loan Types</Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Manage loan type master records
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
                        Add Loan Type
                    </Button>
                </Box>
            </Box>

            <Drawer anchor='right' open={openAdd} onClose={resetDrawer}>
                <Box className='w-[420px] max-w-full p-6'>
                    <Box className='flex items-center justify-between mb-4'>
                        <Typography variant='h6'>New Loan Type</Typography>
                        <IconButton onClick={resetDrawer} aria-label='Close add loan type'>
                            <i className='ri-close-line' />
                        </IconButton>
                    </Box>
                    <LoanTypesCreateForm
                        showTitle={false}
                        onSuccess={id => {
                            refresh()
                            setLastCreatedId(id || null)
                            setSuccessOpen(true)
                            setSaved(true)
                        }}
                        onCancel={resetDrawer}
                        submitDisabled={saved}
                    />
                    {successOpen && lastCreatedId ? (
                        <Box
                            sx={{
                                mt: 3,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                p: 2,
                                borderRadius: 2,
                                border: '1px solid',
                                borderColor: 'rgb(var(--mui-palette-success-mainChannel) / 0.35)',
                                background: 'rgb(var(--mui-palette-background-paperChannel) / 0.6)',
                                backdropFilter: 'blur(10px)',
                                boxShadow: '0 10px 30px rgb(var(--mui-palette-success-mainChannel) / 0.2)'
                            }}
                        >
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: '50%',
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: 'var(--mui-palette-success-main)',
                                    color: 'var(--mui-palette-success-contrastText)',
                                    boxShadow: '0 8px 18px rgb(var(--mui-palette-success-mainChannel) / 0.35)'
                                }}
                            >
                                <i className='ri-check-line text-lg' />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant='subtitle2'>Loan type added!</Typography>
                            </Box>
                            <Button
                                variant='contained'
                                size='small'
                                onClick={() => {
                                    setSuccessOpen(false)
                                    setOpenAdd(false)
                                    router.push(`/loan-types/${lastCreatedId}?edit=1#documents`)
                                }}
                            >
                                Add Checklist
                            </Button>
                        </Box>
                    ) : null}
                </Box>
            </Drawer>

            <Table>
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell align='center'>Checklist</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align='right'>Actions</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={4}>Loading...</TableCell>
                        </TableRow>
                    ) : loanTypes.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4}>No loan types found</TableCell>
                        </TableRow>
                    ) : (
                        loanTypes.map(lt => {
                            const iconMeta = getLoanTypeIcon(lt.name)

                            return (
                                <TableRow key={lt.id}>
                                    <TableCell>
                                        <MuiLink
                                            component={Link}
                                            href={`/loan-types/${lt.id}`}
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
                                                <span>{lt.name}</span>
                                            </Box>
                                        </MuiLink>
                                    </TableCell>
                                    <TableCell align='center'>
                                        {lt.checklistCount && lt.checklistCount > 0 ? (
                                            <Chip
                                                size='small'
                                                label={lt.checklistCount}
                                                variant='outlined'
                                                sx={{
                                                    boxShadow: 'none',
                                                    backgroundColor: 'rgb(var(--mui-palette-text-primaryChannel) / 0.04)'
                                                }}
                                            />
                                        ) : (
                                            <Button
                                                size='small'
                                                variant='outlined'
                                                startIcon={<i className='ri-add-line' />}
                                                onClick={() => openMapping(lt.id, lt.name)}
                                            >
                                                Add Checklist
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={lt.isActive ? 'Active' : 'Inactive'}
                                            color={lt.isActive ? 'success' : 'default'}
                                            variant='outlined'
                                            size='small'
                                            sx={{
                                                boxShadow: 'none',
                                                backgroundColor: 'transparent',
                                                borderRadius: 1.1
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align='right'>
                                        <Button
                                            color='error'
                                            size='small'
                                            variant='outlined'
                                            onClick={() => setConfirmId(lt.id)}
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

            <Dialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)}>
                <DialogTitle>Delete Loan Type</DialogTitle>
                <DialogContent>
                    <Typography>Are you sure you want to delete this loan type?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button variant='text' onClick={() => setConfirmId(null)} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button color='error' variant='contained' onClick={confirmDelete} disabled={deleting}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog open={mappingOpen} onClose={() => setMappingOpen(false)} maxWidth='sm' fullWidth>
                <DialogTitle>Add Checklist</DialogTitle>
                <DialogContent>
                    <Box className='flex flex-col gap-3'>
                        <Typography variant='subtitle2'>
                            {mappingLoanType ? `Loan Type: ${mappingLoanType.name}` : 'Loan Type'}
                        </Typography>
                        {mappingError ? <Alert severity='error'>{mappingError}</Alert> : null}
                        {mappingLoading ? (
                            <Typography variant='body2' color='text.secondary'>
                                Loading checklists...
                            </Typography>
                        ) : mappingDocs.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No checklists available to map.
                            </Typography>
                        ) : (
                            <Box className='flex flex-col gap-2'>
                                {mappingDocs.map(doc => {
                                    const selected = mappingSelections.find(m => m.documentId === doc.id)

                                    return (
                                        <Box
                                            key={doc.id}
                                            className='flex flex-col gap-2 rounded-lg p-3 md:flex-row md:items-center'
                                            sx={{
                                                border: '1px solid',
                                                borderColor: 'var(--mui-palette-divider)',
                                                background: 'rgb(var(--mui-palette-background-paperChannel) / 0.4)',
                                                backdropFilter: 'blur(8px)'
                                            }}
                                        >
                                            <Box className='flex items-center gap-2 md:flex-1'>
                                                <Checkbox
                                                    checked={Boolean(selected)}
                                                    onChange={() => toggleMapping(doc.id)}
                                                />
                                                <Box>
                                                    <Typography variant='subtitle2'>{doc.name}</Typography>
                                                    <Typography variant='body2' color='text.secondary'>
                                                        {doc.description || 'No description'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <FormControl size='small' sx={{ minWidth: 140 }}>
                                                <TextField
                                                    select
                                                    size='small'
                                                    label='Status'
                                                    value={selected?.status || 'REQUIRED'}
                                                    onChange={e => updateMappingStatus(doc.id, e.target.value as LoanTypeDocumentStatus)}
                                                    disabled={!selected}
                                                >
                                                    {STATUS_OPTIONS.map(option => (
                                                        <MenuItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </TextField>
                                            </FormControl>
                                        </Box>
                                    )
                                })}
                            </Box>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button variant='text' onClick={() => setMappingOpen(false)} disabled={mappingSaving}>
                        Cancel
                    </Button>
                    <Button
                        variant='contained'
                        onClick={saveMappings}
                        disabled={mappingSaving || mappingLoading || mappingDocs.length === 0}
                    >
                        {mappingSaving ? 'Saving...' : 'Save Mapping'}
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
                    icon={toast.severity === 'success' ? <i className='ri-checkbox-circle-line' /> : <i className='ri-close-circle-line' />}
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

export default LoanTypesList
