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
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import InputAdornment from '@mui/material/InputAdornment'

import { createLoanType, suggestLoanTypeCode } from '@features/loan-types/services/loanTypesService'

type Props = {
  onSuccess?: (id?: string) => void
  onCancel?: () => void
  showTitle?: boolean
  submitDisabled?: boolean
  initialValues?: Partial<{
    code: string
    name: string
    description: string | null
    isActive: boolean
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
}

const generateCodeFromName = (value: string) => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9]+/g, ' ')
  const parts = cleaned.split(' ').filter(Boolean)

  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase()

  return parts
    .map(p => p[0])
    .join('')
    .slice(0, 6)
    .toUpperCase()
}

const LoanTypesCreateForm = ({ onSuccess, onCancel, showTitle = true, submitDisabled, initialValues, onSubmitOverride, submitLabel }: Props) => {
  const router = useRouter()

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!initialValues) return
    if (initialValues.code != null) setCode(initialValues.code)
    if (initialValues.name != null) setName(initialValues.name)
    if (initialValues.description !== undefined) setDescription(initialValues.description || '')
    if (initialValues.isActive != null) setIsActive(Boolean(initialValues.isActive))
  }, [initialValues])

  useEffect(() => {
    if (initialValues?.code) return
    const snapshot = name
    const localCode = generateCodeFromName(snapshot)

    setCode(localCode)

    if (!localCode) return

    const controller = new AbortController()

    const timer = setTimeout(async () => {
      try {
        const suggested = await suggestLoanTypeCode(snapshot, controller.signal)

        if (suggested && snapshot === name) setCode(suggested)
      } catch { }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [initialValues?.code, name])

  const validate = () => {
    const next: Record<string, string> = {}

    if (code.trim().length < 2) next.code = 'Code is required'
    if (name.trim().length < 2) next.name = 'Name is required'
    setFieldErrors(next)

    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setError(null)

    try {
      let createdId: string | undefined

      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim().length === 0 ? null : description.trim(),
        isActive
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        const res = await createLoanType(payload)

        createdId = res?.id
      }

      if (onSuccess) onSuccess(createdId)
      if (!onSuccess && !onSubmitOverride) router.push('/loan-types')
    } catch (e: any) {
      setError(e?.message || 'Failed to save loan type')
      if (e?.details && typeof e.details === 'object') setFieldErrors(e.details)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title='Add Loan Type' subheader='Define a loan type and its properties' /> : null}
      <CardContent>
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={3}>
          <Typography variant='subtitle2' color='text.secondary'>
            Basic Information
          </Typography>
          <Box>
            <Typography variant='caption' color='text.secondary'>
              Code
            </Typography>
            <Box className='mt-1 flex items-center gap-2 rounded border border-solid border-[var(--mui-palette-divider)] px-3 py-2'>
              <i className='ri-barcode-line' />
              <Typography variant='body2'>{code || '—'}</Typography>
            </Box>
            {fieldErrors.code ? (
              <Typography variant='caption' color='error'>
                {fieldErrors.code}
              </Typography>
            ) : (
              <Typography variant='caption' color='text.secondary'>
                Auto-generated from name
              </Typography>
            )}
          </Box>
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
                  <i className='ri-file-list-3-line' />
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
                  <i className='ri-file-text-line' />
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
      <CardActions sx={{ px: 3, pb: 3 }}>
        <Box className='flex gap-3'>
          <Button variant='contained' disabled={submitting || submitDisabled} onClick={handleSubmit}>
            {submitting ? 'Saving...' : submitLabel || 'Save Loan Type'}
          </Button>
          <Button
            variant='outlined'
            disabled={submitting}
            onClick={() => (onCancel ? onCancel() : router.push('/loan-types'))}
          >
            Cancel
          </Button>
        </Box>
      </CardActions>
    </Card>
  )
}

export default LoanTypesCreateForm
