'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

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
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import FormControl from '@mui/material/FormControl'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import LoanTypesCreateForm from '@features/loan-types/components/LoanTypesCreateForm'
import DocumentChecklistsCreateForm from '@features/document-checklists/components/DocumentChecklistsCreateForm'
import { deleteLoanType, getLoanType, getLoanTypeDocuments, updateLoanType, updateLoanTypeDocuments } from '@features/loan-types/services/loanTypesService'
import type { LoanTypeDocumentItem, LoanTypeDocumentMapping, LoanTypeDocumentStatus } from '@features/loan-types/loan-types.types'

type Props = { id: string }

const STATUS_OPTIONS: Array<{ value: LoanTypeDocumentStatus; label: string }> = [
  { value: 'REQUIRED', label: 'Required' },
  { value: 'OPTIONAL', label: 'Optional' },
  { value: 'INACTIVE', label: 'Inactive' }
]

const LoanTypeDetails = ({ id }: Props) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [documents, setDocuments] = useState<LoanTypeDocumentItem[]>([])
  const [mappings, setMappings] = useState<LoanTypeDocumentMapping[]>([])
  const [mappingSaving, setMappingSaving] = useState(false)
  const [mappingError, setMappingError] = useState<string | null>(null)
  const [newDocumentId, setNewDocumentId] = useState('')

  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success'
  })

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await getLoanType(id)

      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  const loadDocuments = useCallback(async () => {
    try {
      const res = await getLoanTypeDocuments(id)

      setDocuments(res?.documents ?? [])
      setMappings(res?.mappings ?? [])
    } catch (e: any) {
      setMappingError(e?.message || 'Failed to load documents')
    }
  }, [id])

  useEffect(() => {
    load()
    loadDocuments()
  }, [load, loadDocuments])

  useEffect(() => {
    if (searchParams.get('edit') === '1') setEditMode(true)
  }, [searchParams])

  const mappedById = useMemo(() => {
    const map = new Map<string, LoanTypeDocumentMapping>()

    mappings.forEach(m => map.set(m.documentId, m))

    return map
  }, [mappings])

  const persistMappings = async (nextMappings: LoanTypeDocumentMapping[]) => {
    setMappingSaving(true)
    setMappingError(null)
    setMappings(nextMappings)

    try {
      await updateLoanTypeDocuments(id, nextMappings)

      setToast({ open: true, msg: 'Documents updated', severity: 'success' })
    } catch (e: any) {
      setMappingError(e?.message || 'Failed to update documents')
    } finally {
      setMappingSaving(false)
    }
  }

  const addDocument = async () => {
    if (!newDocumentId) return

    if (mappedById.has(newDocumentId)) {
      setMappingError('Document already added')

      return
    }

    const nextMappings = [...mappings, { documentId: newDocumentId, status: 'REQUIRED' as LoanTypeDocumentStatus }]

    setNewDocumentId('')
    setMappingError(null)
    await persistMappings(nextMappings as LoanTypeDocumentMapping[])
  }

  const updateStatus = async (documentId: string, status: LoanTypeDocumentStatus) => {
    const nextMappings = mappings.map(m => (m.documentId === documentId ? { ...m, status } : m))

    await persistMappings(nextMappings)
  }

  const removeMapping = async (documentId: string) => {
    const nextMappings = mappings.filter(m => m.documentId !== documentId)

    await persistMappings(nextMappings)
  }

  const handleDelete = async () => {
    try {
      await deleteLoanType(id)

      router.push('/loan-types')
    } catch {
      setToast({ open: true, msg: 'Failed to delete loan type', severity: 'error' })
    }
  }

  if (loading) {

    return (
      <Box className='p-6'>
        <Typography>Loading...</Typography>
      </Box>
    )
  }

  if (!data) {

    return (
      <Box className='p-6'>
        <Typography>Loan type not found</Typography>
      </Box>
    )
  }

  const mappedRows = mappings
    .map(m => {
      const doc = documents.find(d => d.id === m.documentId)

      return doc ? { ...doc, status: m.status } : null
    })
    .filter(Boolean) as Array<LoanTypeDocumentItem & { status: LoanTypeDocumentStatus }>

  return (
    <Box className='flex flex-col gap-4'>
      <Card>
        <CardHeader
          title='Loan Type Details'
          action={
            <Box className='flex gap-2'>
              <Button size='small' variant='text' onClick={() => router.push('/loan-types')} startIcon={<i className='ri-arrow-left-line' />}>
                Back to Loan Types
              </Button>
              <Button size='small' variant='outlined' onClick={() => setEditMode(v => !v)}>
                {editMode ? 'Close Edit' : 'Edit'}
              </Button>
              <Button size='small' color='error' variant='outlined' onClick={() => setConfirmOpen(true)}>
                Delete
              </Button>
            </Box>
          }
        />
        <CardContent>
          {editMode ? (
            <LoanTypesCreateForm
              showTitle={false}
              initialValues={{
                name: data.name,
                description: data.description,
                isActive: data.isActive
              }}
              submitLabel='Update Loan Type'
              onSubmitOverride={async payload => {
                await updateLoanType(id, payload)
                setEditMode(false)
                await load()
              }}
            />
          ) : (
            <Box className='flex flex-col gap-3'>
              <Box className='flex items-center gap-3'>
                <Typography variant='h6'>{data.name}</Typography>
                <Chip
                  label={data.isActive ? 'Active' : 'Inactive'}
                  color={data.isActive ? 'success' : 'default'}
                  size='small'
                  variant='outlined'
                  sx={{
                    boxShadow: 'none',
                    backgroundColor: 'transparent',
                    borderRadius: 1.1
                  }}
                />
              </Box>
              <Typography variant='body2'>{data.description || 'No description'}</Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card id='documents'>
        <CardHeader title='Document Checklist Mapping' subheader='Map documents to this loan type and set status' />
        <CardContent>
          {mappingError ? <Alert severity='error' sx={{ mb: 2 }}>{mappingError}</Alert> : null}
          <Box className='flex flex-col gap-3 md:flex-row md:items-center'>
            <FormControl size='small' sx={{ minWidth: 240 }}>
              <TextField
                select
                size='small'
                label='Add Document'
                value={newDocumentId}
                onChange={e => setNewDocumentId(e.target.value)}
                disabled={mappingSaving}
              >
                {documents.length === 0 ? (
                  <MenuItem value=''>No documents available</MenuItem>
                ) : (
                  documents.map(d => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.name}
                    </MenuItem>
                  ))
                )}
              </TextField>
            </FormControl>
            <Box className='flex flex-col gap-2 sm:flex-row sm:items-center'>
              <Button variant='outlined' onClick={addDocument} disabled={!newDocumentId || mappingSaving}>
                Add
              </Button>
              <Button
                variant='text'
                onClick={() => setCreateOpen(true)}
                startIcon={<i className='ri-add-line' />}
                disabled={mappingSaving}
              >
                Create Checklist
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Document</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {mappedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>No documents mapped yet</TableCell>
                </TableRow>
              ) : (
                mappedRows.map(row => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.description || '-'}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        size='small'
                        value={row.status}
                        onChange={e => updateStatus(row.id, e.target.value as LoanTypeDocumentStatus)}
                        disabled={mappingSaving}
                      >
                        {STATUS_OPTIONS.map(opt => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align='right'>
                      <IconButton aria-label='Remove document' onClick={() => removeMapping(row.id)} disabled={mappingSaving}>
                        <i className='ri-delete-bin-line' />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Loan Type</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>This will permanently delete the loan type.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button color='error' variant='contained' onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth='sm' fullScreen={fullScreen}>
        <DialogTitle>Create Checklist</DialogTitle>
        <DialogContent>
          <DocumentChecklistsCreateForm
            showTitle={false}
            onSuccess={async () => {
              setCreateOpen(false)
              await loadDocuments()
              setToast({ open: true, msg: 'Checklist created', severity: 'success' })
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </Box>
  )
}

export default LoanTypeDetails
