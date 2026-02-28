'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import InputAdornment from '@mui/material/InputAdornment'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import { createDocumentChecklist } from '@features/document-checklists/services/documentChecklistsService'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  initialValues?: Partial<{
    name: string
    description: string | null
    isActive: boolean
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
  redirectOnSuccess?: boolean
  redirectPath?: string
}

const DocumentChecklistsCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  initialValues,
  onSubmitOverride,
  submitLabel,
  redirectOnSuccess = false,
  redirectPath = '/document-checklists'
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [redirectOpen, setRedirectOpen] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null)
  const [redirectProgress, setRedirectProgress] = useState(0)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!initialValues) return
    if (initialValues.name != null) setName(initialValues.name)
    if (initialValues.description !== undefined) setDescription(initialValues.description || '')
    if (initialValues.isActive != null) setIsActive(Boolean(initialValues.isActive))
  }, [initialValues])

  useEffect(() => {
    if (!redirectOpen || !redirectTarget) return

    setRedirectProgress(0)
    const totalMs = 2200
    const tickMs = 50
    const step = (100 * tickMs) / totalMs
    let current = 0

    const t = window.setInterval(() => {
      current = Math.min(100, current + step)
      setRedirectProgress(current)

      if (current >= 100) {
        window.clearInterval(t)
        router.push(redirectTarget)
      }
    }, tickMs)

    return () => window.clearInterval(t)
  }, [redirectOpen, redirectTarget, router])

  const validate = () => {
    const next: Record<string, string> = {}

    if (name.trim().length < 2) next.name = 'Name is required'
    setFieldErrors(next)

    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: name.trim(),
        description: description.trim().length === 0 ? null : description.trim(),
        isActive
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        await createDocumentChecklist(payload)
      }

      setSuccessMsg(initialValues ? 'Document updated successfully' : 'Document created successfully')

      if (redirectOnSuccess) {
        if (onSuccess) onSuccess()
        setRedirectTarget(redirectPath)
        setRedirectOpen(true)

        return
      }

      if (onSuccess) onSuccess()
      if (!onSuccess && !onSubmitOverride) router.push('/document-checklists')
    } catch (e: any) {
      setError(e?.message || 'Failed to save document checklist')
      if (e?.details && typeof e.details === 'object') setFieldErrors(e.details)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title='Add Document Checklist' subheader='Define a document and its description' /> : null}
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={isMobile ? 2 : 3}>
          <Typography variant='subtitle2' color='text.secondary'>
            Basic Information
          </Typography>
          <TextField
            label='Name'
            value={name}
            onChange={e => setName(e.target.value)}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-file-text-line' />
                </InputAdornment>
              )
            }}
          />
          <TextField
            label='Description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-sticky-note-line' />
                </InputAdornment>
              )
            }}
          />
          <Divider />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
            label={isActive ? 'Active' : 'Inactive'}
          />
        </Stack>
      </CardContent>
      <CardActions sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: '100%' }}>
          <Button variant='contained' disabled={submitting} onClick={handleSubmit} fullWidth={isMobile}>
            {submitting ? 'Saving...' : submitLabel || 'Save Document'}
          </Button>
          <Button
            variant='outlined'
            disabled={submitting}
            onClick={() => (onCancel ? onCancel() : router.push('/document-checklists'))}
            fullWidth={isMobile}
          >
            Cancel
          </Button>
        </Box>
      </CardActions>

      <Dialog open={redirectOpen} onClose={() => undefined} disableEscapeKeyDown>
        <DialogContent sx={{ p: 3, width: { xs: 'calc(100vw - 32px)', sm: 420 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)', color: 'success.main' }}>
                <i className='ri-checkbox-circle-line' />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                  {successMsg}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Taking you back to Document Checklist...
                </Typography>
              </Box>
            </Box>
            <LinearProgress variant='determinate' value={redirectProgress} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant='caption' color='text.secondary'>
                Please wait
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {Math.round(redirectProgress)}%
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default DocumentChecklistsCreateForm
