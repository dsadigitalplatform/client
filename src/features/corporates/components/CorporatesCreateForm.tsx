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
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { createCorporate, previewCorporateCode } from '@features/corporates/services/corporatesService'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  variant?: 'card' | 'plain'
  initialValues?: Partial<{
    code: string
    name: string
    isActive: boolean
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
  redirectOnSuccess?: boolean
  redirectPath?: string
}

const CorporatesCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  variant = 'card',
  initialValues,
  onSubmitOverride,
  submitLabel,
  redirectOnSuccess = false,
  redirectPath = '/corporates'
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const useCard = variant === 'card'
  const isEditMode = Boolean(initialValues)

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const didHydrateFromInitialValues = useRef(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [codePreview, setCodePreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [createdCode, setCreatedCode] = useState<string | null>(null)

  useEffect(() => {
    if (!initialValues) {
      didHydrateFromInitialValues.current = false

      return
    }

    if (didHydrateFromInitialValues.current) return

    didHydrateFromInitialValues.current = true

    if (initialValues.code != null) setCode(initialValues.code)
    if (initialValues.name != null) setName(initialValues.name)
    if (initialValues.isActive != null) setIsActive(Boolean(initialValues.isActive))
  }, [initialValues])

  useEffect(() => {
    if (isEditMode) return

    const trimmed = name.trim()

    if (trimmed.length < 2) {
      setCodePreview(null)

      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)

      try {
        const preview = await previewCorporateCode(trimmed)

        if (!cancelled) setCodePreview(preview || null)
      } catch {
        if (!cancelled) setCodePreview(null)
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isEditMode, name])

  const canSubmit = name.trim().length >= 2
  const displayedCode = isEditMode ? initialValues?.code || code || '' : createdCode || codePreview || ''

  const handleSubmit = async () => {
    setError(null)

    const validationErrors: Record<string, string> = {}

    if (name.trim().length < 2) validationErrors.name = 'Name must be at least 2 characters'

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)

      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      const payload = {
        name: name.trim(),
        isActive
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        const res = await createCorporate(payload)

        setCreatedCode(res?.code ? String(res.code) : null)
      }

      if (onSuccess) onSuccess()

      if (redirectOnSuccess) {
        if (!initialValues) {
          router.push(`${redirectPath}?created=1`)
        }

        return
      }

      if (!initialValues) {
        setName('')
        setIsActive(true)
        setCreatedCode(null)
        setCodePreview(null)
      }

      setFieldErrors({})
      setError(null)
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to save corporate')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <Stack spacing={2}>
      {showTitle ? <Typography variant='h5'>{initialValues ? 'Update Corporate' : 'Add Corporate'}</Typography> : null}
      {error ? (
        <Alert severity='error' sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      {!isEditMode && createdCode ? (
        <Alert severity='success'>
          Corporate created with code <strong>{createdCode}</strong>
        </Alert>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!isEditMode ? (
          <Alert severity='info' icon={false} sx={{ py: 1 }}>
            {previewLoading
              ? 'Generating code preview...'
              : displayedCode
                ? `Next code preview: ${displayedCode}`
                : 'A unique corporate code will be generated from your code generation template.'}
          </Alert>
        ) : (
          <TextField label='Code' value={displayedCode || '-'} fullWidth disabled helperText='Auto-generated when created' />
        )}
        <TextField
          label='Name'
          value={name}
          onChange={e => setName(e.target.value)}
          error={Boolean(fieldErrors.name)}
          helperText={fieldErrors.name || 'Used by {INITIALS} in code templates'}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-building-line' />
              </InputAdornment>
            )
          }}
        />
        <FormControlLabel
          control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
          label={isActive ? 'Active' : 'Inactive'}
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
            {submitLabel || (initialValues ? 'Update Corporate' : 'Create Corporate')}
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title={initialValues ? 'Update Corporate' : 'Add Corporate'} /> : null}
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
          {submitLabel || (initialValues ? 'Update Corporate' : 'Create Corporate')}
        </Button>
      </CardActions>
      {!isMobile ? <Divider /> : null}
    </Card>
  )
}

export default CorporatesCreateForm
