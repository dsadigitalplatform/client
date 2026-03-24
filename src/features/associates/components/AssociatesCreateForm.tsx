'use client'

import { useEffect, useMemo, useState } from 'react'

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

import { createAssociate } from '@features/associates/services/associatesService'

const COUNTRY_CODE_OPTIONS = [
  { code: '+91', iso: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+1', iso: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+65', iso: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+61', iso: 'AU', name: 'Australia', flag: '🇦🇺' }
] as const

const buildBaseCode = (associateName: string, companyName: string, mobile: string) => {
  const nameWords = associateName.trim().split(/\s+/).filter(Boolean)
  const companyWords = companyName.trim().split(/\s+/).filter(Boolean)

  const nameInitials =
    nameWords.length > 0 ? nameWords.slice(0, 2).map(w => w[0]?.toUpperCase()).join('') : associateName.trim().slice(0, 2).toUpperCase()

  const companyKeyRaw = companyWords.length > 0 ? companyWords.join('') : companyName
  const companyKey = companyKeyRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3)

  const last4 = mobile.replace(/\D/g, '').slice(-4)

  return [nameInitials, companyKey, last4].filter(Boolean).join('-')
}

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  variant?: 'card' | 'plain'
  initialValues?: Partial<{
    associateName: string
    companyName: string
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

  const [associateName, setAssociateName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [payout, setPayout] = useState<string>('')
  const [pan, setPan] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const selectedCountry = useMemo(
    () => COUNTRY_CODE_OPTIONS.find(o => o.code === countryCode) || COUNTRY_CODE_OPTIONS[0],
    [countryCode]
  )

  useEffect(() => {
    if (!initialValues) return
    if (initialValues.associateName != null) setAssociateName(initialValues.associateName)
    if (initialValues.companyName != null) setCompanyName(initialValues.companyName)
    if (initialValues.mobile != null) setMobile(initialValues.mobile)
    if (initialValues.countryCode != null) setCountryCode(initialValues.countryCode)
    if (initialValues.email !== undefined) setEmail(initialValues.email || '')
    if (initialValues.payout !== undefined && initialValues.payout !== null) setPayout(String(initialValues.payout))
    if (initialValues.pan !== undefined) setPan(initialValues.pan || '')
    if (initialValues.isActive !== undefined) setIsActive(Boolean(initialValues.isActive))
  }, [initialValues])

  const isValidMobile = (v: string) => /^[0-9]{9,10}$/.test(v)
  const isValidCountryCode = (v: string) => /^\+[0-9]{1,4}$/.test(v)
  const isValidEmail = (v: string) => !v || /^.+@.+\..+$/.test(v)
  const isValidPAN = (v: string) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)
  const isValidPayout = (v: string) => !v || (/^\d+(\.\d+)?$/.test(v) && Number(v) >= 0 && Number(v) <= 100)

  const canSubmit =
    associateName.trim().length >= 2 &&
    companyName.trim().length >= 2 &&
    isValidCountryCode(countryCode) &&
    isValidMobile(mobile) &&
    isValidEmail(email) &&
    isValidPAN(pan) &&
    isValidPayout(payout)

  const codePreview = useMemo(
    () => buildBaseCode(associateName, companyName, mobile),
    [associateName, companyName, mobile]
  )

  const handleMobile = (v: string) => {
    setMobile(v.replace(/\D/g, '').slice(0, 10))
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
    setFieldErrors({})
    setSubmitting(true)

    try {
      const payload = {
        associateName: associateName.trim(),
        companyName: companyName.trim(),
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
        await createAssociate(payload)
      }

      if (onSuccess) onSuccess()

      if (redirectOnSuccess) {
        if (!initialValues) {
          router.push(redirectPath)
        }

        return
      }

      setAssociateName('')
      setCompanyName('')
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <TextField
            label='Associate Name'
            value={associateName}
            onChange={e => setAssociateName(e.target.value)}
            error={Boolean(fieldErrors.associateName)}
            helperText={
              fieldErrors.associateName || (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Typography variant='caption' color='text.secondary'>
                    Code
                  </Typography>
                  <Typography
                    component='sup'
                    variant='caption'
                    color='primary.main'
                    sx={{
                      fontWeight: 700,
                      borderRadius: 999,
                      px: 0.75,
                      py: 0.1,
                      backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                      lineHeight: 1
                    }}
                  >
                    {initialValues?.code || codePreview || '-'}
                  </Typography>
                </Box>
              )
            }
            fullWidth
            InputProps={{
              endAdornment:
                initialValues?.code || codePreview ? (
                  <InputAdornment position='end'>
                    <Typography
                      component='sup'
                      variant='caption'
                      color='primary.main'
                      sx={{
                        fontWeight: 700,
                        borderRadius: 999,
                        px: 0.75,
                        py: 0.1,
                        backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                        lineHeight: 1
                      }}
                    >
                      {initialValues?.code || codePreview}
                    </Typography>
                  </InputAdornment>
                ) : undefined
            }}
          />
        </Box>
        <TextField
          label='Company Name'
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          error={Boolean(fieldErrors.companyName)}
          helperText={fieldErrors.companyName}
          fullWidth
        />
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <FormControl fullWidth sx={{ width: { xs: '100%', sm: 180 } }}>
            <InputLabel id='associate-country-code-label'>Country Code</InputLabel>
            <Select
              labelId='associate-country-code-label'
              label='Country Code'
              value={countryCode}
              onChange={e => setCountryCode(String(e.target.value))}
              renderValue={() => `${selectedCountry.flag} ${selectedCountry.code}`}
            >
              {COUNTRY_CODE_OPTIONS.map(o => (
                <MenuItem key={`${o.iso}-${o.code}`} value={o.code}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{o.flag}</span>
                      <Typography variant='body2'>{o.name}</Typography>
                    </Box>
                    <Typography variant='body2' color='text.secondary'>
                      {o.code}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label='Mobile Number'
            value={mobile}
            onChange={e => handleMobile(e.target.value)}
            error={Boolean(fieldErrors.mobile)}
            helperText={fieldErrors.mobile}
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
