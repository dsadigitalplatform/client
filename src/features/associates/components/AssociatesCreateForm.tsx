'use client'

import { useEffect, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import Checkbox from '@mui/material/Checkbox'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { createAssociate, previewAssociateCode } from '@features/associates/services/associatesService'
import { getAssociateTypes } from '@features/associate-types/services/associateTypesService'
import CountryCodeField from '@/components/CountryCodeField'
import { COUNTRY_CODE_VALIDATION_MESSAGE, isValidCountryCode } from '@/lib/countryCodes'
import {
  isValidMobileDigits,
  MOBILE_VALIDATION_MESSAGE,
  normalizeMobileDigits
} from '@/lib/mobile'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  variant?: 'card' | 'plain'
  initialValues?: Partial<{
    associateName: string
    companyName: string
    associateTypeId: string
    mobile: string
    countryCode: string
    email: string | null
    payout: number | null
    code: string
    pan: string | null
    isActive: boolean
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
  redirectOnSuccess?: boolean
  redirectPath?: string
}

const AssociatesCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  variant = 'card',
  initialValues,
  onSubmitOverride,
  submitLabel,
  redirectOnSuccess = false,
  redirectPath = '/associates'
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const useCard = variant === 'card'
  const isEditMode = Boolean(initialValues)

  const [associateName, setAssociateName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [associateTypeId, setAssociateTypeId] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [payout, setPayout] = useState<string>('')
  const [pan, setPan] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [associateTypes, setAssociateTypes] = useState<Array<{ id: string; name: string; isActive: boolean }>>([])
  const [associateTypesLoading, setAssociateTypesLoading] = useState(false)
  const associateTypeIdRef = useRef('')
  const didHydrateFromInitialValues = useRef(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [codePreview, setCodePreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [createdCode, setCreatedCode] = useState('')

  useEffect(() => {
    if (!initialValues) {
      didHydrateFromInitialValues.current = false

      return
    }

    if (didHydrateFromInitialValues.current) return

    didHydrateFromInitialValues.current = true

    if (initialValues.associateName != null) setAssociateName(initialValues.associateName)
    if (initialValues.companyName != null) setCompanyName(initialValues.companyName)
    if (initialValues.associateTypeId != null) setAssociateTypeId(initialValues.associateTypeId)
    if (initialValues.mobile != null) setMobile(normalizeMobileDigits(String(initialValues.mobile)))
    if (initialValues.countryCode != null) setCountryCode(initialValues.countryCode)
    if (initialValues.email !== undefined) setEmail(initialValues.email || '')
    if (initialValues.payout !== undefined && initialValues.payout !== null) setPayout(String(initialValues.payout))
    if (initialValues.pan !== undefined) setPan(initialValues.pan || '')
    if (initialValues.isActive !== undefined) setIsActive(Boolean(initialValues.isActive))
  }, [initialValues])

  useEffect(() => {
    associateTypeIdRef.current = associateTypeId
  }, [associateTypeId])

  useEffect(() => {
    let active = true

    const loadAssociateTypes = async () => {
      setAssociateTypesLoading(true)

      try {
        const rows = await getAssociateTypes()

        if (!active) return
        const activeRows = (rows || []).filter((r: any) => r?.isActive)

        setAssociateTypes(activeRows)

        if (initialValues?.associateTypeId) {
          setAssociateTypeId(initialValues.associateTypeId)

          return
        }

        if (!associateTypeIdRef.current && activeRows.length > 0) {
          setAssociateTypeId(String(activeRows[0].id))
        }
      } finally {
        if (active) setAssociateTypesLoading(false)
      }
    }

    loadAssociateTypes()

    return () => {
      active = false
    }
  }, [initialValues?.associateTypeId])

  useEffect(() => {
    if (isEditMode) return

    const trimmedName = associateName.trim()
    const trimmedCompany = companyName.trim()

    if (trimmedName.length < 2 || trimmedCompany.length < 2) {
      setCodePreview(null)

      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true)

      try {
        const preview = await previewAssociateCode({
          associateName: trimmedName,
          companyName: trimmedCompany
        })

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
  }, [associateName, companyName, isEditMode])

  const isValidMobile = isValidMobileDigits
  const isValidEmail = (v: string) => !v || /^.+@.+\..+$/.test(v)
  const isValidPAN = (v: string) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)
  const isValidPayout = (v: string) => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0 && Number(v) <= 100)

  const canSubmit =
    associateName.trim().length >= 2 &&
    companyName.trim().length >= 2 &&
    associateTypeId.trim().length > 0 &&
    isValidCountryCode(countryCode) &&
    isValidMobile(mobile) &&
    isValidEmail(email) &&
    isValidPAN(pan) &&
    isValidPayout(payout)

  const displayedCode = isEditMode ? initialValues?.code || '' : createdCode || codePreview || ''

  const handleMobile = (v: string) => {
    setMobile(normalizeMobileDigits(v))
  }

  const handlePAN = (v: string) => {
    setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
  }

  const handlePayout = (v: string) => {
    const next = v.replace(/[^\d.]/g, '')
    const firstDot = next.indexOf('.')
    const cleaned = firstDot === -1 ? next : `${next.slice(0, firstDot + 1)}${next.slice(firstDot + 1).replace(/\./g, '')}`

    setPayout(cleaned.slice(0, 6))
  }

  const handleSubmit = async () => {
    setError(null)

    const validationErrors: Record<string, string> = {}

    if (!isValidCountryCode(countryCode)) validationErrors.countryCode = COUNTRY_CODE_VALIDATION_MESSAGE

    if (!isValidMobile(mobile)) validationErrors.mobile = MOBILE_VALIDATION_MESSAGE

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)

      return
    }

    setFieldErrors({})
    setSubmitting(true)

    try {
      const payload = {
        associateName: associateName.trim(),
        companyName: companyName.trim(),
        associateTypeId,
        countryCode,
        mobile,
        email: email ? email.trim() : null,
        payout: payout ? Number(payout) : null,
        pan: pan ? pan.toUpperCase() : null,
        isActive
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        const result = await createAssociate(payload)

        if (result.code) setCreatedCode(result.code)
      }

      if (onSuccess) onSuccess()

      if (redirectOnSuccess) {
        if (!initialValues) {
          router.push(`${redirectPath}?created=1`)
        }

        return
      }

      setAssociateName('')
      setCompanyName('')
      setAssociateTypeId('')
      setCountryCode('+91')
      setMobile('')
      setEmail('')
      setPayout('')
      setPan('')
      setIsActive(true)
      setFieldErrors({})
      setError(null)
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to save associate')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <Stack spacing={2}>
      {showTitle ? <Typography variant='h5'>{initialValues ? 'Update Associate' : 'Add Associate'}</Typography> : null}
      {error ? (
        <Alert severity='error' sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      {!isEditMode && createdCode ? (
        <Alert severity='success'>
          Associate created with code <strong>{createdCode}</strong>
        </Alert>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <TextField
            label='Associate Name'
            value={associateName}
            onChange={e => setAssociateName(e.target.value)}
            error={Boolean(fieldErrors.associateName)}
            helperText={fieldErrors.associateName}
            fullWidth
          />
        </Box>
        {!isEditMode ? (
          <Alert severity='info' icon={false} sx={{ py: 1 }}>
            {previewLoading
              ? 'Generating code preview...'
              : displayedCode
                ? `Next code preview: ${displayedCode}`
                : 'A unique associate code will be generated from your code generation template.'}
          </Alert>
        ) : (
          <TextField label='Code' value={displayedCode || '-'} fullWidth disabled helperText='Auto-generated when created' />
        )}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <TextField
            label='Company Name'
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
            error={Boolean(fieldErrors.companyName)}
            helperText={fieldErrors.companyName || 'Used by {COMPANY_NAME} in code templates'}
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel id='associate-type-label'>Associate Type</InputLabel>
            <Select
              labelId='associate-type-label'
              label='Associate Type'
              value={associateTypeId}
              onChange={e => setAssociateTypeId(String(e.target.value))}
              disabled={associateTypesLoading}
              error={Boolean(fieldErrors.associateTypeId)}
            >
              {associateTypes.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
            {fieldErrors.associateTypeId ? (
              <Typography variant='caption' color='error' sx={{ mt: 0.5 }}>
                {fieldErrors.associateTypeId}
              </Typography>
            ) : !associateTypesLoading && associateTypes.length === 0 ? (
              <Typography variant='caption' color='text.secondary' sx={{ mt: 0.5 }}>
                No active associate types available
              </Typography>
            ) : null}
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <CountryCodeField
            labelId='associate-country-code-label'
            value={countryCode}
            onChange={setCountryCode}
            error={Boolean(fieldErrors.countryCode) || (countryCode.length > 0 && !isValidCountryCode(countryCode))}
            helperText={
              fieldErrors.countryCode ||
              (countryCode.length > 0 && !isValidCountryCode(countryCode) ? COUNTRY_CODE_VALIDATION_MESSAGE : ' ')
            }
            sx={{ width: { xs: '100%', sm: 220 } }}
          />
          <TextField
            label='Mobile Number'
            value={mobile}
            onChange={e => handleMobile(e.target.value)}
            error={Boolean(fieldErrors.mobile) || (mobile.length > 0 && !isValidMobile(mobile))}
            helperText={
              fieldErrors.mobile || (mobile.length > 0 && !isValidMobile(mobile) ? MOBILE_VALIDATION_MESSAGE : ' ')
            }
            fullWidth
            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-smartphone-line' />
                </InputAdornment>
              )
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <TextField
            label='Email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
            fullWidth
          />
          <TextField
            label='Payout (%)'
            value={payout}
            onChange={e => handlePayout(e.target.value)}
            error={Boolean(fieldErrors.payout)}
            helperText={fieldErrors.payout}
            fullWidth
            InputProps={{ endAdornment: <InputAdornment position='end'>%</InputAdornment> }}
          />
        </Box>
        <TextField
          label='PAN Card No'
          value={pan}
          onChange={e => handlePAN(e.target.value)}
          error={Boolean(fieldErrors.pan)}
          helperText={fieldErrors.pan}
          fullWidth
        />
      </Box>
      <FormControlLabel
        control={<Checkbox checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
        label='Active'
      />
    </Stack>
  )

  if (!useCard) {
    return (
      <Box>
        {submitting ? <LinearProgress sx={{ mb: 2 }} /> : null}
        {content}
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
          {onCancel ? (
            <Button variant='outlined' onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          <Button variant='contained' onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitLabel || (initialValues ? 'Update Associate' : 'Create Associate')}
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title={initialValues ? 'Update Associate' : 'Add Associate'} /> : null}
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {submitting ? <LinearProgress sx={{ mb: 2 }} /> : null}
        {content}
      </CardContent>
      <CardActions sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 }, justifyContent: 'flex-end', gap: 1.5 }}>
        {onCancel ? (
          <Button variant='outlined' onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button variant='contained' onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitLabel || (initialValues ? 'Update Associate' : 'Create Associate')}
        </Button>
      </CardActions>
      {!isMobile ? <Divider /> : null}
    </Card>
  )
}

export default AssociatesCreateForm
