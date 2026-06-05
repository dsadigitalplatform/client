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

import { createAdvocate } from '@features/advocates/services/advocatesService'
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
    name: string
    mobile: string
    countryCode: string
    email: string | null
    address: string | null
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
  redirectOnSuccess?: boolean
  redirectPath?: string
}

const AdvocatesCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  variant = 'card',
  initialValues,
  onSubmitOverride,
  submitLabel,
  redirectOnSuccess = false,
  redirectPath = '/advocates'
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const useCard = variant === 'card'

  const [name, setName] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
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

    if (initialValues.name != null) setName(initialValues.name)
    if (initialValues.mobile != null) setMobile(normalizeMobileDigits(String(initialValues.mobile)))
    if (initialValues.countryCode != null) setCountryCode(initialValues.countryCode)
    if (initialValues.email !== undefined) setEmail(initialValues.email || '')
    if (initialValues.address !== undefined) setAddress(initialValues.address || '')
  }, [initialValues])

  const isValidMobile = isValidMobileDigits
  const isValidEmail = (v: string) => !v || /^.+@.+\..+$/.test(v)

  const canSubmit =
    name.trim().length >= 2 &&
    isValidCountryCode(countryCode) &&
    isValidMobile(mobile) &&
    isValidEmail(email)

  const handleMobile = (v: string) => {
    setMobile(normalizeMobileDigits(v))
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
        name: name.trim(),
        countryCode,
        mobile,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        await createAdvocate(payload)
      }

      if (onSuccess) onSuccess()

      if (redirectOnSuccess) {
        if (!initialValues) {
          router.push(`${redirectPath}?created=1`)
        }

        return
      }

      setName('')
      setCountryCode('+91')
      setMobile('')
      setEmail('')
      setAddress('')
      setFieldErrors({})
      setError(null)
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to save advocate')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <Stack spacing={2}>
      {showTitle ? <Typography variant='h5'>{initialValues ? 'Update Advocate' : 'Add Advocate'}</Typography> : null}
      {error ? (
        <Alert severity='error' sx={{ mb: 1 }}>
          {error}
        </Alert>
      ) : null}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label='Name'
          value={name}
          onChange={e => setName(e.target.value)}
          error={Boolean(fieldErrors.name)}
          helperText={fieldErrors.name}
          fullWidth
        />
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <CountryCodeField
            labelId='advocate-country-code-label'
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
        <TextField
          label='Email Address'
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={Boolean(fieldErrors.email)}
          helperText={
            fieldErrors.email || (email.length > 0 && !isValidEmail(email) ? 'Enter a valid email address' : ' ')
          }
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-mail-line' />
              </InputAdornment>
            )
          }}
        />
        <TextField
          label='Address'
          value={address}
          onChange={e => setAddress(e.target.value)}
          error={Boolean(fieldErrors.address)}
          helperText={fieldErrors.address}
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start' sx={{ alignSelf: 'flex-start', mt: 1.5 }}>
                <i className='ri-map-pin-line' />
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
            {submitLabel || (initialValues ? 'Update Advocate' : 'Create Advocate')}
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title={initialValues ? 'Update Advocate' : 'Add Advocate'} /> : null}
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
          {submitLabel || (initialValues ? 'Update Advocate' : 'Create Advocate')}
        </Button>
      </CardActions>
      {!isMobile ? <Divider /> : null}
    </Card>
  )
}

export default AdvocatesCreateForm
