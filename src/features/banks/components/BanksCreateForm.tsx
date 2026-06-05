'use client'

import { useEffect, useRef, useState } from 'react'

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
import InputAdornment from '@mui/material/InputAdornment'
import LinearProgress from '@mui/material/LinearProgress'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { createBank } from '@features/banks/services/banksService'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  variant?: 'card' | 'plain'
  initialValues?: Partial<{
    code: string
    name: string
    description: string | null
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
  redirectOnSuccess?: boolean
  redirectPath?: string
}

const BanksCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  variant = 'card',
  initialValues,
  onSubmitOverride,
  submitLabel,
  redirectOnSuccess = false,
  redirectPath = '/banks'
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const useCard = variant === 'card'

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const didHydrateFromInitialValues = useRef(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!initialValues) {
      didHydrateFromInitialValues.current = false

      return
    }

    if (didHydrateFromInitialValues.current) return

    didHydrateFromInitialValues.current = true

    if (initialValues.code != null) setCode(initialValues.code)
    if (initialValues.name != null) setName(initialValues.name)
    if (initialValues.description !== undefined) setDescription(initialValues.description || '')
  }, [initialValues])

  const canSubmit = code.trim().length >= 1 && name.trim().length >= 2

  const handleSubmit = async () => {
    setError(null)

    const validationErrors: Record<string, string> = {}

    if (code.trim().length < 1) validationErrors.code = 'Code is required'
    if (name.trim().length < 2) validationErrors.name = 'Bank name must be at least 2 characters'
    if (description.length > 500) validationErrors.description = 'Description must be ≤ 500 characters'

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)

      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description ? description.trim() : null
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        await createBank(payload)
      }

      if (onSuccess) onSuccess()

      if (redirectOnSuccess) {
        if (!initialValues) {
          router.push(`${redirectPath}?created=1`)
        }

        return
      }

      setCode('')
      setName('')
      setDescription('')
      setFieldErrors({})
      setError(null)
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to save bank')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <Stack spacing={2}>
      {showTitle ? <Typography variant='h5'>{initialValues ? 'Update Bank' : 'Add Bank'}</Typography> : null}
      {error ? (
        <Alert severity='error' sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label='Code'
          value={code}
          onChange={e => setCode(e.target.value)}
          error={Boolean(fieldErrors.code)}
          helperText={fieldErrors.code || 'Must be unique within your organisation'}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-hashtag' />
              </InputAdornment>
            )
          }}
        />
        <TextField
          label='Bank Name'
          value={name}
          onChange={e => setName(e.target.value)}
          error={Boolean(fieldErrors.name)}
          helperText={fieldErrors.name}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-bank-line' />
              </InputAdornment>
            )
          }}
        />
        <TextField
          label='Description'
          value={description}
          onChange={e => setDescription(e.target.value)}
          error={Boolean(fieldErrors.description)}
          helperText={fieldErrors.description}
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start' sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                <i className='ri-file-text-line' />
              </InputAdornment>
            )
          }}
        />
      </Box>
    </Stack>
  )

  if (!useCard) {
    return (
      <Box>
        {submitting ? <LinearProgress sx={{ mb: 2 }} /> : null}
        {content}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', flexDirection: { xs: 'column-reverse', sm: 'row' } }}>
          {onCancel ? (
            <Button variant='outlined' onClick={onCancel} fullWidth={isMobile}>
              Cancel
            </Button>
          ) : null}
          <Button variant='contained' onClick={handleSubmit} disabled={!canSubmit || submitting} fullWidth={isMobile}>
            {submitLabel || (initialValues ? 'Update Bank' : 'Create Bank')}
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title={initialValues ? 'Update Bank' : 'Add Bank'} /> : null}
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {submitting ? <LinearProgress sx={{ mb: 2 }} /> : null}
        {content}
      </CardContent>
      <CardActions
        sx={{
          px: { xs: 2.5, sm: 3 },
          pb: { xs: 2.5, sm: 3 },
          justifyContent: 'flex-end',
          gap: 1.5,
          flexDirection: { xs: 'column-reverse', sm: 'row' }
        }}
      >
        {onCancel ? (
          <Button variant='outlined' onClick={onCancel} fullWidth={isMobile}>
            Cancel
          </Button>
        ) : null}
        <Button variant='contained' onClick={handleSubmit} disabled={!canSubmit || submitting} fullWidth={isMobile}>
          {submitLabel || (initialValues ? 'Update Bank' : 'Create Bank')}
        </Button>
      </CardActions>
      {!isMobile ? <Divider /> : null}
    </Card>
  )
}

export default BanksCreateForm
