'use client'

import { useCallback, useEffect, useState } from 'react'

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

import DocumentChecklistsCreateForm from '@features/document-checklists/components/DocumentChecklistsCreateForm'
import { deleteDocumentChecklist, getDocumentChecklist, updateDocumentChecklist } from '@features/document-checklists/services/documentChecklistsService'

type Props = { id: string }

const DocumentChecklistDetails = ({ id }: Props) => {
    const router = useRouter()
    const [data, setData] = useState<any | null>(null)
    const [loading, setLoading] = useState(true)
    const [editMode, setEditMode] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)

    const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
        open: false,
        msg: '',
        severity: 'success'
    })

    const load = useCallback(async () => {
        setLoading(true)

        try {
            const res = await getDocumentChecklist(id)

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
            await deleteDocumentChecklist(id)

            router.push('/document-checklists')
        } catch {
            setToast({ open: true, msg: 'Failed to delete document', severity: 'error' })
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
                <Typography>Document not found</Typography>
            </Box>
        )
    }

    return (
        <Box className='flex flex-col gap-4'>
            <Card>
                <CardHeader
                    title='Document Details'
                    action={
                        <Box className='flex gap-2'>
                            <Button size='small' variant='text' onClick={() => router.push('/document-checklists')}>
                                Back to List
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
                        <DocumentChecklistsCreateForm
                            showTitle={false}
                            initialValues={{
                                name: data.name,
                                description: data.description,
                                isActive: data.isActive
                            }}
                            submitLabel='Update Document'
                            onSubmitOverride={async payload => {
                                await updateDocumentChecklist(id, payload)
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
                                        backgroundColor: data.isActive
                                            ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                            : 'rgb(var(--mui-palette-text-primaryChannel) / 0.06)'
                                    }}
                                />
                            </Box>
                            <Typography variant='body2'>{data.description || 'No description'}</Typography>
                        </Box>
                    )}
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
                <DialogTitle>Delete Document</DialogTitle>
                <DialogContent>
                    <Typography variant='body2'>This will permanently delete the document.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button color='error' variant='contained' onClick={handleDelete}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    )
}

export default DocumentChecklistDetails
