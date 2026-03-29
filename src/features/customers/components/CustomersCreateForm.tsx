'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { useRouter } from 'next/navigation'

import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Slider from '@mui/material/Slider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import FormHelperText from '@mui/material/FormHelperText'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { createCustomer, getCustomerByMobile, updateCustomer } from '@features/customers/services/customersService'

const COUNTRY_CODE_OPTIONS = [
  { code: '+91', iso: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+1', iso: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+65', iso: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+61', iso: 'AU', name: 'Australia', flag: '🇦🇺' }
] as const

const SECONDARY_CONTACT_TYPE_OPTIONS = [
  { value: 'ALTERNATE', label: 'Alternate' },
  { value: 'SPOUSE', label: 'Spouse' },
  { value: 'FRIEND', label: 'Friend' },
  { value: 'RELATIVE', label: 'Relative' },
  { value: 'OTHER', label: 'Other' }
] as const

const SECONDARY_CONTACT_LIMIT = 3

type SecondaryContactType = (typeof SECONDARY_CONTACT_TYPE_OPTIONS)[number]['value']

type SecondaryContact = {
  countryCode: string
  mobile: string
  type: SecondaryContactType
}

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  variant?: 'card' | 'plain'
  initialValues?: Partial<{
    fullName: string
    mobile: string
    countryCode: string
    isNRI: boolean
    secondaryContacts: SecondaryContact[]
    email: string | null
    dob: string | null
    pan: string | null
    aadhaarMasked: string | null
    address: string | null
    remarks: string | null
    employmentType: 'SALARIED' | 'SELF_EMPLOYED'
    source: 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'
    monthlyIncome: number | null
    cibilScore: number | null
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
  redirectOnSuccess?: boolean
  redirectPath?: string
}

const CustomersCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  variant = 'card',
  initialValues,
  onSubmitOverride,
  submitLabel,
  redirectOnSuccess = false,
  redirectPath = '/customers'
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const useCard = variant === 'card'

  const [fullName, setFullName] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [isNRI, setIsNRI] = useState(false)
  const [secondaryContacts, setSecondaryContacts] = useState<SecondaryContact[]>([])
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [pan, setPan] = useState('')
  const [aadhaarMasked, setAadhaarMasked] = useState('')
  const [aadhaarDigits, setAadhaarDigits] = useState('')
  const [address, setAddress] = useState('')
  const [remarks, setRemarks] = useState('')
  const [employmentType, setEmploymentType] = useState<'SALARIED' | 'SELF_EMPLOYED'>('SALARIED')
  const [source, setSource] = useState<'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'>('WALK_IN')
  const [monthlyIncome, setMonthlyIncome] = useState<string>('')
  const [cibilScore, setCibilScore] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [redirectOpen, setRedirectOpen] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null)
  const [redirectProgress, setRedirectProgress] = useState(0)
  const [successMsg, setSuccessMsg] = useState('')
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null)
  const [successDialogOpen, setSuccessDialogOpen] = useState(false)
  const [matchedCustomerId, setMatchedCustomerId] = useState<string | null>(null)
  const lastLookupMobileRef = useRef('')

  useEffect(() => {
    if (!initialValues) return
    if (initialValues.fullName != null) setFullName(initialValues.fullName)
    if (initialValues.mobile != null) setMobile(initialValues.mobile)
    if (initialValues.countryCode != null) setCountryCode(initialValues.countryCode)
    if (initialValues.isNRI != null) setIsNRI(Boolean(initialValues.isNRI))
    if (initialValues.secondaryContacts !== undefined) setSecondaryContacts(initialValues.secondaryContacts || [])
    if (initialValues.email !== undefined) setEmail(initialValues.email || '')
    if (initialValues.dob != null) setDob(initialValues.dob ? initialValues.dob.slice(0, 10) : '')
    if (initialValues.pan !== undefined) setPan(initialValues.pan || '')
    if (initialValues.aadhaarMasked !== undefined) setAadhaarMasked(initialValues.aadhaarMasked || '')
    setAadhaarDigits('')
    if (initialValues.address !== undefined) setAddress(initialValues.address || '')
    if (initialValues.remarks !== undefined) setRemarks(initialValues.remarks || '')
    if (initialValues.employmentType) setEmploymentType(initialValues.employmentType)
    if (initialValues.source) setSource(initialValues.source)
    if (initialValues.monthlyIncome !== undefined && initialValues.monthlyIncome !== null)
      setMonthlyIncome(String(initialValues.monthlyIncome))
    if (initialValues.cibilScore !== undefined && initialValues.cibilScore !== null)
      setCibilScore(String(initialValues.cibilScore))
  }, [initialValues])

  useEffect(() => {
    if (initialValues) return

    if (!/^[0-9]{9,10}$/.test(mobile)) {
      setMatchedCustomerId(null)
      lastLookupMobileRef.current = ''

      return
    }

    if (mobile === lastLookupMobileRef.current) return
    lastLookupMobileRef.current = mobile

    let active = true

    const run = async () => {
      try {
        const found = await getCustomerByMobile(mobile)

        if (!active) return

        if (!found?.id) {
          setMatchedCustomerId(null)

          return
        }

        setMatchedCustomerId(found.id)
        if (found.fullName != null) setFullName(found.fullName)
        if (found.countryCode != null) setCountryCode(found.countryCode)
        if (found.mobile != null) setMobile(found.mobile)
        setIsNRI(Boolean(found.isNRI))
        setSecondaryContacts(Array.isArray(found.secondaryContacts) ? found.secondaryContacts : [])
        setEmail(found.email || '')
        setDob(found.dob ? String(found.dob).slice(0, 10) : '')
        setPan(found.pan || '')
        setAadhaarMasked(found.aadhaarMasked || '')
        setAadhaarDigits('')
        setAddress(found.address || '')
        setRemarks(found.remarks || '')
        if (found.employmentType) setEmploymentType(found.employmentType)
        if (found.source) setSource(found.source)
        if (found.monthlyIncome !== undefined && found.monthlyIncome !== null) setMonthlyIncome(String(found.monthlyIncome))
        if (found.cibilScore !== undefined && found.cibilScore !== null) setCibilScore(String(found.cibilScore))
        setFieldErrors({})
        setError(null)
      } catch {
        if (!active) return
        setMatchedCustomerId(null)
      }
    }

    run()

    return () => {
      active = false
    }
  }, [initialValues, mobile])

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
        if (onSuccess) onSuccess()
        setRedirectOpen(false)
      }
    }, tickMs)

    return () => window.clearInterval(t)
  }, [onSuccess, redirectOpen, redirectTarget, router])

  // basic client-side validators
  const isValidMobile = (v: string) => /^[0-9]{9,10}$/.test(v)
  const isValidCountryCode = (v: string) => /^\+[0-9]{1,4}$/.test(v)
  const isValidEmail = (v: string) => !v || /^.+@.+\..+$/.test(v)
  const isValidPAN = (v: string) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)
  const isValidAadhaar = (digits: string) => digits.length === 0 || digits.length === 12
  const isValidCibil = (v: string) => !v || (/^\d+$/.test(v) && Number(v) >= 300 && Number(v) <= 900)
  const isValidContactType = (v: string) => SECONDARY_CONTACT_TYPE_OPTIONS.some(option => option.value === v)

  const isSecondaryContactValid = (contact: SecondaryContact) =>
    isValidCountryCode(contact.countryCode) && isValidMobile(contact.mobile) && isValidContactType(contact.type)

  const canSubmit =
    fullName.trim().length >= 2 &&
    isValidCountryCode(countryCode) &&
    isValidMobile(mobile) &&
    isValidEmail(email) &&
    isValidPAN(pan) &&
    isValidAadhaar(aadhaarDigits) &&
    isValidCibil(cibilScore) &&
    secondaryContacts.length <= SECONDARY_CONTACT_LIMIT &&
    secondaryContacts.every(isSecondaryContactValid)

  // input normalizers
  const handleMobile = (v: string) => {
    setMobile(v.replace(/\D/g, '').slice(0, 10))
  }

  const handlePAN = (v: string) => {
    setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
  }

  const handleAadhaar = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 12)

    setAadhaarDigits(digits)

    if (digits.length < 4) {
      setAadhaarMasked('')

      return
    }

    const last4 = digits.slice(-4)

    setAadhaarMasked(`XXXX-XXXX-${last4}`)
  }

  const handleSecondaryContactType = (index: number, value: string) => {
    setSecondaryContacts(prev =>
      prev.map((contact, i) => (i === index ? { ...contact, type: value as SecondaryContactType } : contact))
    )
  }

  const handleSecondaryContactCountryCode = (index: number, value: string) => {
    setSecondaryContacts(prev =>
      prev.map((contact, i) => (i === index ? { ...contact, countryCode: value } : contact))
    )
  }

  const handleSecondaryContactMobile = (index: number, value: string) => {
    const nextMobile = value.replace(/\D/g, '').slice(0, 10)

    setSecondaryContacts(prev =>
      prev.map((contact, i) => (i === index ? { ...contact, mobile: nextMobile } : contact))
    )
  }

  const handleAddSecondaryContact = () => {
    setSecondaryContacts(prev => {
      if (prev.length >= SECONDARY_CONTACT_LIMIT) return prev

      return [...prev, { countryCode, mobile: '', type: 'ALTERNATE' }]
    })
  }

  const handleRemoveSecondaryContact = (index: number) => {
    setSecondaryContacts(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setError(null)
    setFieldErrors({})
    setSubmitting(true)

    try {
      const payload = {
        fullName: fullName.trim(),
        countryCode,
        mobile,
        isNRI,
        secondaryContacts: secondaryContacts.map(contact => ({
          countryCode: contact.countryCode,
          mobile: contact.mobile,
          type: contact.type
        })),
        email: email ? email.trim() : null,
        dob: dob ? new Date(dob).toISOString() : null,
        pan: pan ? pan.toUpperCase() : null,
        aadhaarMasked: aadhaarMasked || null,
        address: address || null,
        remarks: remarks ? remarks.trim() : null,
        employmentType,
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : null,
        cibilScore: cibilScore ? Number(cibilScore) : null,
        source
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else if (matchedCustomerId) {
        await updateCustomer(matchedCustomerId, payload)
      } else {
        const res = await createCustomer(payload)

        setCreatedCustomerId(res?.id ? String(res.id) : null)
      }

      setSuccessMsg(isEditing ? 'Customer updated successfully' : 'Customer created successfully')

      if (redirectOnSuccess) {
        if (isEditing) {
          setSuccessDialogOpen(false)
          setRedirectTarget(redirectPath)
          setRedirectOpen(true)

          return
        }

        setRedirectOpen(false)
        setRedirectTarget(null)
        setSuccessDialogOpen(true)

        setFullName('')
        setCountryCode('+91')
        setMobile('')
        setIsNRI(false)
        setSecondaryContacts([])
        setEmail('')
        setDob('')
        setPan('')
        setAadhaarMasked('')
        setAadhaarDigits('')
        setAddress('')
        setRemarks('')
        setEmploymentType('SALARIED')
        setSource('WALK_IN')
        setMonthlyIncome('')
        setCibilScore('')
        setFieldErrors({})
        setError(null)

        return
      }

      if (!isEditing) {
        setFullName('')
        setMobile('')
        setSecondaryContacts([])
        setEmail('')
        setDob('')
        setPan('')
        setAadhaarMasked('')
        setAadhaarDigits('')
        setAddress('')
        setRemarks('')
        setEmploymentType('SALARIED')
        setSource('WALK_IN')
        setMonthlyIncome('')
        setCibilScore('')
        setCreatedCustomerId(null)
        setFieldErrors({})
        setError(null)
      }

      if (onSuccess) onSuccess()
      else router.push('/customers')
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to create customer')
    } finally {
      setSubmitting(false)
    }
  }

  const canCreateLeadFromSuccess = Boolean(createdCustomerId) && !initialValues

  const handleCreateLeadFromSuccess = () => {
    if (!createdCustomerId) return
    setSuccessDialogOpen(false)
    if (onSuccess) onSuccess()
    router.push(`/loan-cases/create?customerId=${encodeURIComponent(createdCustomerId)}`)
  }

  const handleGoToCustomersFromSuccess = () => {
    setSuccessDialogOpen(false)
    if (onSuccess) onSuccess()
    router.push(redirectPath)
  }

  const successDialog = (
    <Dialog
      open={successDialogOpen}
      onClose={() => undefined}
      PaperProps={{
        sx: {
          width: { xs: 'calc(100vw - 32px)', sm: 460 },
          borderRadius: 4,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgb(var(--mui-palette-background-paperChannel) / 0.72)',
          backdropFilter: 'blur(14px)',
          boxShadow: 'var(--mui-customShadows-lg, 0px 10px 34px rgba(0,0,0,0.18))'
        }
      }}
    >
      <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2.25}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)',
                color: 'success.main',
                border: '1px solid',
                borderColor: 'rgb(var(--mui-palette-success-mainChannel) / 0.22)'
              }}
            >
              <i className='ri-checkbox-circle-line' />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
                {successMsg}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                What would you like to do next?
              </Typography>
            </Box>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            {canCreateLeadFromSuccess ? (
              <Button
                variant='contained'
                onClick={handleCreateLeadFromSuccess}
                startIcon={<i className='ri-lightbulb-flash-line' />}
                fullWidth={isMobile}
              >
                Create Lead
              </Button>
            ) : null}
            <Button variant='outlined' onClick={handleGoToCustomersFromSuccess} fullWidth={isMobile}>
              Go to Customers
            </Button>
          </Stack>
        </Stack>
      </DialogContent>
    </Dialog>
  )

  const isEditing = Boolean(initialValues || matchedCustomerId)
  const mobileTitle = submitLabel || (isEditing ? 'Update Customer' : 'Add Customer')

  const selectedCountry = useMemo(() => {
    return COUNTRY_CODE_OPTIONS.find(o => o.code === countryCode) || COUNTRY_CODE_OPTIONS[0]
  }, [countryCode])

  const canAddSecondaryContact = secondaryContacts.length < SECONDARY_CONTACT_LIMIT

  return useCard ? (
    <Card
      sx={{
        borderRadius: { xs: 4, sm: 3 },
        boxShadow: isMobile ? 'none' : 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))',
        border: isMobile ? '1px solid' : 'none',
        borderColor: isMobile ? 'divider' : 'transparent'
      }}
    >
      {showTitle && !isMobile ? (
        <CardHeader title='Add Customer' subheader='Enter customer details to create a new record' />
      ) : null}
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {isMobile ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Button
              variant='text'
              onClick={() => (onCancel ? onCancel() : router.push('/customers'))}
              startIcon={<i className='ri-arrow-left-line' />}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Back
            </Button>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              {mobileTitle}
            </Typography>
            <IconButton
              color='primary'
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              aria-label='Save customer'
            >
              <i className='ri-check-line' />
            </IconButton>
          </Box>
        ) : null}
        {isMobile ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <i className='ri-user-line text-2xl' />
            </Avatar>
          </Box>
        ) : null}
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={isMobile ? 2 : 3}>
          <Typography variant='subtitle2' color='text.secondary'>
            Basic Information
          </Typography>
          <TextField
            label='Full Name'
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            error={!!fieldErrors.fullName}
            helperText={fieldErrors.fullName}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-user-line' />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position='end' sx={{ mr: -0.5 }}>
                  <FormControlLabel
                    control={<Checkbox checked={isNRI} onChange={e => setIsNRI(e.target.checked)} size='small' />}
                    label='NRI'
                    sx={{ mr: 0 }}
                  />
                </InputAdornment>
              )
            }}
          />

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 2 }
            }}
          >
            <FormControl fullWidth sx={{ width: { xs: '100%', sm: 180 } }}>
              <InputLabel id='customer-country-code-label'>Country Code</InputLabel>
              <Select
                labelId='customer-country-code-label'
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
              label='Mobile'
              value={mobile}
              onChange={e => handleMobile(e.target.value)}
              error={Boolean(fieldErrors.mobile) || (mobile.length > 0 && !isValidMobile(mobile))}
              helperText={
                fieldErrors.mobile || (mobile.length > 0 && !isValidMobile(mobile) ? 'Enter a 9 or 10-digit mobile number' : ' ')
              }
              fullWidth
              required
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

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
              gap: 1
            }}
          >
            <Typography variant='subtitle2' color='text.secondary'>
              Secondary Contacts
            </Typography>
            <Button
              size='small'
              variant='outlined'
              onClick={handleAddSecondaryContact}
              disabled={!canAddSecondaryContact}
              startIcon={<i className='ri-add-line' />}
              fullWidth={isMobile}
            >
              Add Contact
            </Button>
          </Box>
          <TableContainer
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflowX: 'auto'
            }}
          >
            <Table size='small' sx={{ minWidth: 520 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 170 }}>Type</TableCell>
                  <TableCell sx={{ width: 150 }}>Country Code</TableCell>
                  <TableCell sx={{ width: 200 }}>Mobile</TableCell>
                  <TableCell sx={{ width: 80 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {secondaryContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography variant='body2' color='text.secondary'>
                        No secondary contacts added
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  secondaryContacts.map((contact, index) => {
                    const contactCountry =
                      COUNTRY_CODE_OPTIONS.find(option => option.code === contact.countryCode) || COUNTRY_CODE_OPTIONS[0]

                    const typeError = fieldErrors[`secondaryContacts.${index}.type`]

                    const countryError =
                      fieldErrors[`secondaryContacts.${index}.countryCode`] ||
                      (contact.countryCode.length > 0 && !isValidCountryCode(contact.countryCode) ? 'Invalid country code' : '')

                    const mobileError =
                      fieldErrors[`secondaryContacts.${index}.mobile`] ||
                      (contact.mobile.length > 0 && !isValidMobile(contact.mobile) ? 'Enter a 9 or 10-digit mobile number' : '')

                    return (
                      <TableRow key={`secondary-contact-${index}`}>
                        <TableCell>
                          <FormControl size='small' fullWidth error={Boolean(typeError)}>
                            <Select
                              value={contact.type}
                              onChange={e => handleSecondaryContactType(index, String(e.target.value))}
                            >
                              {SECONDARY_CONTACT_TYPE_OPTIONS.map(option => (
                                <MenuItem key={option.value} value={option.value}>
                                  {option.label}
                                </MenuItem>
                              ))}
                            </Select>
                            {typeError ? <FormHelperText>{typeError}</FormHelperText> : null}
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <FormControl size='small' fullWidth error={Boolean(countryError)}>
                            <Select
                              value={contact.countryCode}
                              onChange={e => handleSecondaryContactCountryCode(index, String(e.target.value))}
                              renderValue={() => `${contactCountry.flag} ${contactCountry.code}`}
                            >
                              {COUNTRY_CODE_OPTIONS.map(option => (
                                <MenuItem key={`${option.iso}-${option.code}-secondary`} value={option.code}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      width: '100%'
                                    }}
                                  >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <span>{option.flag}</span>
                                      <Typography variant='body2'>{option.name}</Typography>
                                    </Box>
                                    <Typography variant='body2' color='text.secondary'>
                                      {option.code}
                                    </Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                            {countryError ? <FormHelperText>{countryError}</FormHelperText> : null}
                          </FormControl>
                        </TableCell>
                        <TableCell>
                          <TextField
                            size='small'
                            value={contact.mobile}
                            onChange={e => handleSecondaryContactMobile(index, e.target.value)}
                            error={Boolean(mobileError)}
                            helperText={mobileError || ' '}
                            fullWidth
                            inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            color='error'
                            size='small'
                            onClick={() => handleRemoveSecondaryContact(index)}
                            aria-label='Remove secondary contact'
                          >
                            <i className='ri-delete-bin-line' />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {fieldErrors.secondaryContacts ? <FormHelperText error>{fieldErrors.secondaryContacts}</FormHelperText> : null}
          <Typography variant='caption' color='text.secondary'>
            Up to {SECONDARY_CONTACT_LIMIT} secondary contacts
          </Typography>

          <TextField
            label='Email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            type='email'
            error={Boolean(fieldErrors.email) || (email.length > 0 && !isValidEmail(email))}
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
            label='Remarks'
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            error={!!fieldErrors.remarks}
            helperText={fieldErrors.remarks || 'Optional (max 500 characters)'}
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

          <TextField
            label='Date of Birth'
            type='date'
            value={dob}
            onChange={e => setDob(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Divider />
          <Typography variant='subtitle2' color='text.secondary'>
            Identification
          </Typography>
          <TextField
            label='PAN'
            value={pan}
            onChange={e => handlePAN(e.target.value)}
            error={!!fieldErrors.pan}
            helperText={fieldErrors.pan || 'Uppercase, e.g., ABCDE1234F'}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-id-card-line' />
                </InputAdornment>
              )
            }}
          />

          <TextField
            label='Aadhaar (masked)'
            value={aadhaarMasked}
            onChange={e => handleAadhaar(e.target.value)}
            error={Boolean(fieldErrors.aadhaarMasked) || (aadhaarDigits.length > 0 && !isValidAadhaar(aadhaarDigits))}
            helperText={
              fieldErrors.aadhaarMasked ||
              (aadhaarDigits.length > 0 && !isValidAadhaar(aadhaarDigits) ? 'Enter 12-digit Aadhaar number' : ' ')
            }
            fullWidth
            placeholder='XXXX-XXXX-1234'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-shield-keyhole-line' />
                </InputAdornment>
              )
            }}
            inputProps={{ inputMode: 'numeric' }}
          />

          <TextField
            label='Address'
            value={address}
            onChange={e => setAddress(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-map-pin-line' />
                </InputAdornment>
              )
            }}
          />

          <Divider />
          <Typography variant='subtitle2' color='text.secondary'>
            Employment & Source
          </Typography>
          <TextField
            select
            label='Employment Type'
            value={employmentType}
            onChange={e => setEmploymentType(e.target.value as any)}
            fullWidth
            required
          >
            <MenuItem value='SALARIED'>Salaried</MenuItem>
            <MenuItem value='SELF_EMPLOYED'>Self-employed</MenuItem>
          </TextField>

          <TextField
            select
            label='Source'
            value={source}
            onChange={e => setSource(e.target.value as any)}
            fullWidth
            required
          >
            <MenuItem value='WALK_IN'>Walk-in</MenuItem>
            <MenuItem value='REFERRAL'>Referral</MenuItem>
            <MenuItem value='ONLINE'>Online</MenuItem>
            <MenuItem value='SOCIAL_MEDIA'>Social Media</MenuItem>
            <MenuItem value='OTHER'>Other</MenuItem>
          </TextField>

          <Divider />
          <Typography variant='subtitle2' color='text.secondary'>
            Financial
          </Typography>
          <TextField
            label='Monthly Income'
            value={monthlyIncome}
            onChange={e => setMonthlyIncome(e.target.value.replace(/[^\d.]/g, ''))}
            fullWidth
            placeholder='Optional'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <span>₹</span>
                </InputAdornment>
              )
            }}
          />

          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 3 },
              py: 2
            }}
          >
            <TextField
              label='CIBIL Score'
              value={cibilScore}
              onChange={e => setCibilScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
              error={!!fieldErrors.cibilScore}
              helperText={fieldErrors.cibilScore}
              placeholder='300–900'
              sx={{ width: { xs: '100%', sm: 160 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='ri-speed-up-line' />
                  </InputAdornment>
                )
              }}
            />
            <Box
              sx={{
                flex: 1,
                px: { xs: 0, sm: 2 },
                pt: { xs: 0.5, sm: 0 },
                pb: { xs: 1.5, sm: 0 },
                mx: { xs: 0.5, sm: 0 }
              }}
            >
              <Slider
                min={300}
                max={900}
                step={1}
                value={Number(cibilScore || '650')}
                onChange={(_, v) => setCibilScore(String(v as number))}
                valueLabelDisplay='auto'
                sx={{
                  mt: { xs: 1, sm: 1 },
                  '& .MuiSlider-markLabel': {
                    mt: 0.75,
                    fontSize: '0.75rem'
                  }
                }}
                marks={[
                  { value: 300, label: '300' },
                  { value: 650, label: '650' },
                  { value: 750, label: '750' },
                  { value: 900, label: '900' }
                ]}
              />
            </Box>
          </Box>
        </Stack>
        {isMobile ? (
          <Box sx={{ mt: 3 }}>
            <Button variant='contained' fullWidth disabled={submitting || !canSubmit} onClick={handleSubmit}>
              {submitting ? 'Saving...' : submitLabel || 'Save Customer'}
            </Button>
          </Box>
        ) : null}
      </CardContent>
      {!isMobile ? (
        <CardActions sx={{ p: 3, pt: 0 }}>
          <Box className='flex gap-2'>
            <Button
              variant='contained'
              disabled={submitting || !canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? 'Saving...' : submitLabel || 'Save Customer'}
            </Button>
            <Button
              variant='outlined'
              disabled={submitting}
              onClick={() => (onCancel ? onCancel() : router.push('/customers'))}
            >
              Cancel
            </Button>
          </Box>
        </CardActions>
      ) : null}

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
                  Taking you back to Customer list...
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
      {successDialog}
    </Card>
  ) : (
    <Box>
      <Box sx={{ p: 0 }}>
        {isMobile ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Button
              variant='text'
              onClick={() => (onCancel ? onCancel() : router.push('/customers'))}
              startIcon={<i className='ri-arrow-left-line' />}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Back
            </Button>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              {mobileTitle}
            </Typography>
            <IconButton
              color='primary'
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              aria-label='Save customer'
            >
              <i className='ri-check-line' />
            </IconButton>
          </Box>
        ) : null}
        {isMobile ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <i className='ri-user-line text-2xl' />
            </Avatar>
          </Box>
        ) : null}
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={isMobile ? 2 : 3}>
          <Typography variant='subtitle2' color='text.secondary'>
            Basic Information
          </Typography>
          <TextField
            label='Full Name'
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            error={!!fieldErrors.fullName}
            helperText={fieldErrors.fullName}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-user-line' />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position='end' sx={{ mr: -0.5 }}>
                  <FormControlLabel
                    control={<Checkbox checked={isNRI} onChange={e => setIsNRI(e.target.checked)} size='small' />}
                    label='NRI'
                    sx={{ mr: 0 }}
                  />
                </InputAdornment>
              )
            }}
          />

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 2 }
            }}
          >
            <FormControl fullWidth sx={{ width: { xs: '100%', sm: 180 } }}>
              <InputLabel id='customer-country-code-label-plain'>Country Code</InputLabel>
              <Select
                labelId='customer-country-code-label-plain'
                label='Country Code'
                value={countryCode}
                onChange={e => setCountryCode(String(e.target.value))}
                renderValue={() => `${selectedCountry.flag} ${selectedCountry.code}`}
              >
                {COUNTRY_CODE_OPTIONS.map(o => (
                  <MenuItem key={`${o.iso}-${o.code}-plain`} value={o.code}>
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
              label='Mobile'
              value={mobile}
              onChange={e => handleMobile(e.target.value)}
              error={Boolean(fieldErrors.mobile) || (mobile.length > 0 && !isValidMobile(mobile))}
              helperText={
                fieldErrors.mobile || (mobile.length > 0 && !isValidMobile(mobile) ? 'Enter a 9 or 10-digit mobile number' : ' ')
              }
              fullWidth
              required
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

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { sm: 'center' },
              justifyContent: 'space-between',
              gap: 1
            }}
          >
            <Typography variant='subtitle2' color='text.secondary'>
              Secondary Contacts
            </Typography>
            <Button
              size='small'
              variant='outlined'
              onClick={handleAddSecondaryContact}
              disabled={!canAddSecondaryContact}
              startIcon={<i className='ri-add-line' />}
              fullWidth={isMobile}
            >
              Add Contact
            </Button>
          </Box>
          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {secondaryContacts.length === 0 ? (
                <Box
                  sx={{
                    border: '1px dashed',
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 2,
                    textAlign: 'center'
                  }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    No secondary contacts added
                  </Typography>
                </Box>
              ) : (
                secondaryContacts.map((contact, index) => {
                  const contactCountry =
                    COUNTRY_CODE_OPTIONS.find(option => option.code === contact.countryCode) || COUNTRY_CODE_OPTIONS[0]

                  const typeError = fieldErrors[`secondaryContacts.${index}.type`]

                  const countryError =
                    fieldErrors[`secondaryContacts.${index}.countryCode`] ||
                    (contact.countryCode.length > 0 && !isValidCountryCode(contact.countryCode) ? 'Invalid country code' : '')

                  const mobileError =
                    fieldErrors[`secondaryContacts.${index}.mobile`] ||
                    (contact.mobile.length > 0 && !isValidMobile(contact.mobile) ? 'Enter a 9 or 10-digit mobile number' : '')

                  return (
                    <Box
                      key={`secondary-contact-card-${index}`}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1.5,
                        backgroundColor: 'background.paper'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant='subtitle2' color='text.secondary'>
                          Contact {index + 1}
                        </Typography>
                        <IconButton
                          color='error'
                          size='small'
                          onClick={() => handleRemoveSecondaryContact(index)}
                          aria-label='Remove secondary contact'
                        >
                          <i className='ri-delete-bin-line' />
                        </IconButton>
                      </Box>
                      <FormControl size='small' fullWidth error={Boolean(typeError)}>
                        <InputLabel id={`secondary-contact-type-${index}`}>Type</InputLabel>
                        <Select
                          labelId={`secondary-contact-type-${index}`}
                          label='Type'
                          value={contact.type}
                          onChange={e => handleSecondaryContactType(index, String(e.target.value))}
                        >
                          {SECONDARY_CONTACT_TYPE_OPTIONS.map(option => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </Select>
                        {typeError ? <FormHelperText>{typeError}</FormHelperText> : null}
                      </FormControl>
                      <FormControl size='small' fullWidth error={Boolean(countryError)}>
                        <InputLabel id={`secondary-contact-country-${index}`}>Country Code</InputLabel>
                        <Select
                          labelId={`secondary-contact-country-${index}`}
                          label='Country Code'
                          value={contact.countryCode}
                          onChange={e => handleSecondaryContactCountryCode(index, String(e.target.value))}
                          renderValue={() => `${contactCountry.flag} ${contactCountry.code}`}
                        >
                          {COUNTRY_CODE_OPTIONS.map(option => (
                            <MenuItem key={`${option.iso}-${option.code}-secondary`} value={option.code}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  width: '100%'
                                }}
                              >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <span>{option.flag}</span>
                                  <Typography variant='body2'>{option.name}</Typography>
                                </Box>
                                <Typography variant='body2' color='text.secondary'>
                                  {option.code}
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {countryError ? <FormHelperText>{countryError}</FormHelperText> : null}
                      </FormControl>
                      <TextField
                        size='small'
                        label='Mobile'
                        value={contact.mobile}
                        onChange={e => handleSecondaryContactMobile(index, e.target.value)}
                        error={Boolean(mobileError)}
                        helperText={mobileError || ' '}
                        fullWidth
                        inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                      />
                    </Box>
                  )
                })
              )}
            </Box>
          ) : (
            <TableContainer
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflowX: 'auto'
              }}
            >
              <Table size='small' sx={{ minWidth: 520 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 170 }}>Type</TableCell>
                    <TableCell sx={{ width: 150 }}>Country Code</TableCell>
                    <TableCell sx={{ width: 200 }}>Mobile</TableCell>
                    <TableCell sx={{ width: 80 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {secondaryContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <Typography variant='body2' color='text.secondary'>
                          No secondary contacts added
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    secondaryContacts.map((contact, index) => {
                      const contactCountry =
                        COUNTRY_CODE_OPTIONS.find(option => option.code === contact.countryCode) || COUNTRY_CODE_OPTIONS[0]

                      const typeError = fieldErrors[`secondaryContacts.${index}.type`]

                      const countryError =
                        fieldErrors[`secondaryContacts.${index}.countryCode`] ||
                        (contact.countryCode.length > 0 && !isValidCountryCode(contact.countryCode) ? 'Invalid country code' : '')

                      const mobileError =
                        fieldErrors[`secondaryContacts.${index}.mobile`] ||
                        (contact.mobile.length > 0 && !isValidMobile(contact.mobile) ? 'Enter a 9 or 10-digit mobile number' : '')

                      return (
                        <TableRow key={`secondary-contact-${index}`}>
                          <TableCell>
                            <FormControl size='small' fullWidth error={Boolean(typeError)}>
                              <Select
                                value={contact.type}
                                onChange={e => handleSecondaryContactType(index, String(e.target.value))}
                              >
                                {SECONDARY_CONTACT_TYPE_OPTIONS.map(option => (
                                  <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                  </MenuItem>
                                ))}
                              </Select>
                              {typeError ? <FormHelperText>{typeError}</FormHelperText> : null}
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <FormControl size='small' fullWidth error={Boolean(countryError)}>
                              <Select
                                value={contact.countryCode}
                                onChange={e => handleSecondaryContactCountryCode(index, String(e.target.value))}
                                renderValue={() => `${contactCountry.flag} ${contactCountry.code}`}
                              >
                                {COUNTRY_CODE_OPTIONS.map(option => (
                                  <MenuItem key={`${option.iso}-${option.code}-secondary`} value={option.code}>
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        width: '100%'
                                      }}
                                    >
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <span>{option.flag}</span>
                                        <Typography variant='body2'>{option.name}</Typography>
                                      </Box>
                                      <Typography variant='body2' color='text.secondary'>
                                        {option.code}
                                      </Typography>
                                    </Box>
                                  </MenuItem>
                                ))}
                              </Select>
                              {countryError ? <FormHelperText>{countryError}</FormHelperText> : null}
                            </FormControl>
                          </TableCell>
                          <TableCell>
                            <TextField
                              size='small'
                              value={contact.mobile}
                              onChange={e => handleSecondaryContactMobile(index, e.target.value)}
                              error={Boolean(mobileError)}
                              helperText={mobileError || ' '}
                              fullWidth
                              inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              color='error'
                              size='small'
                              onClick={() => handleRemoveSecondaryContact(index)}
                              aria-label='Remove secondary contact'
                            >
                              <i className='ri-delete-bin-line' />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {fieldErrors.secondaryContacts ? <FormHelperText error>{fieldErrors.secondaryContacts}</FormHelperText> : null}
          <Typography variant='caption' color='text.secondary'>
            Up to {SECONDARY_CONTACT_LIMIT} secondary contacts
          </Typography>

          <TextField
            label='Email'
            value={email}
            onChange={e => setEmail(e.target.value)}
            type='email'
            error={Boolean(fieldErrors.email) || (email.length > 0 && !isValidEmail(email))}
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
            label='Remarks'
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            error={!!fieldErrors.remarks}
            helperText={fieldErrors.remarks || 'Optional (max 500 characters)'}
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

          <TextField
            label='Date of Birth'
            type='date'
            value={dob}
            onChange={e => setDob(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />

          <Divider />
          <Typography variant='subtitle2' color='text.secondary'>
            Identification
          </Typography>
          <TextField
            label='PAN'
            value={pan}
            onChange={e => handlePAN(e.target.value)}
            error={!!fieldErrors.pan}
            helperText={fieldErrors.pan || 'Uppercase, e.g., ABCDE1234F'}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-id-card-line' />
                </InputAdornment>
              )
            }}
          />

          <TextField
            label='Aadhaar (masked)'
            value={aadhaarMasked}
            onChange={e => handleAadhaar(e.target.value)}
            error={Boolean(fieldErrors.aadhaarMasked) || (aadhaarDigits.length > 0 && !isValidAadhaar(aadhaarDigits))}
            helperText={
              fieldErrors.aadhaarMasked ||
              (aadhaarDigits.length > 0 && !isValidAadhaar(aadhaarDigits) ? 'Enter 12-digit Aadhaar number' : ' ')
            }
            fullWidth
            placeholder='XXXX-XXXX-1234'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-shield-keyhole-line' />
                </InputAdornment>
              )
            }}
            inputProps={{ inputMode: 'numeric' }}
          />

          <TextField
            label='Address'
            value={address}
            onChange={e => setAddress(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-map-pin-line' />
                </InputAdornment>
              )
            }}
          />

          <Divider />
          <Typography variant='subtitle2' color='text.secondary'>
            Employment & Source
          </Typography>
          <TextField
            select
            label='Employment Type'
            value={employmentType}
            onChange={e => setEmploymentType(e.target.value as any)}
            fullWidth
            required
          >
            <MenuItem value='SALARIED'>Salaried</MenuItem>
            <MenuItem value='SELF_EMPLOYED'>Self-employed</MenuItem>
          </TextField>

          <TextField
            select
            label='Source'
            value={source}
            onChange={e => setSource(e.target.value as any)}
            fullWidth
            required
          >
            <MenuItem value='WALK_IN'>Walk-in</MenuItem>
            <MenuItem value='REFERRAL'>Referral</MenuItem>
            <MenuItem value='ONLINE'>Online</MenuItem>
            <MenuItem value='SOCIAL_MEDIA'>Social Media</MenuItem>
            <MenuItem value='OTHER'>Other</MenuItem>
          </TextField>

          <Divider />
          <Typography variant='subtitle2' color='text.secondary'>
            Financial
          </Typography>
          <TextField
            label='Monthly Income'
            value={monthlyIncome}
            onChange={e => setMonthlyIncome(e.target.value.replace(/[^\d.]/g, ''))}
            fullWidth
            placeholder='Optional'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <span>₹</span>
                </InputAdornment>
              )
            }}
          />

          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: { xs: 2, sm: 3 },
              py: 2
            }}
          >
            <TextField
              label='CIBIL Score'
              value={cibilScore}
              onChange={e => setCibilScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
              error={!!fieldErrors.cibilScore}
              helperText={fieldErrors.cibilScore}
              placeholder='300–900'
              sx={{ width: { xs: '100%', sm: 160 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='ri-speed-up-line' />
                  </InputAdornment>
                )
              }}
            />
            <Box
              sx={{
                flex: 1,
                px: { xs: 0, sm: 2 },
                pt: { xs: 0.5, sm: 0 },
                pb: { xs: 1.5, sm: 0 },
                mx: { xs: 0.5, sm: 0 }
              }}
            >
              <Slider
                min={300}
                max={900}
                step={1}
                value={Number(cibilScore || '650')}
                onChange={(_, v) => setCibilScore(String(v as number))}
                valueLabelDisplay='auto'
                sx={{
                  mt: { xs: 1, sm: 1 },
                  '& .MuiSlider-markLabel': {
                    mt: 0.75,
                    fontSize: '0.75rem'
                  }
                }}
                marks={[
                  { value: 300, label: '300' },
                  { value: 650, label: '650' },
                  { value: 750, label: '750' },
                  { value: 900, label: '900' }
                ]}
              />
            </Box>
          </Box>
        </Stack>
      </Box>
      {isMobile ? (
        <Box sx={{ mt: 3 }}>
          <Button variant='contained' fullWidth disabled={submitting || !canSubmit} onClick={handleSubmit}>
            {submitting ? 'Saving...' : submitLabel || 'Save Customer'}
          </Button>
        </Box>
      ) : (
        <Box sx={{ mt: 2 }}>
          <Box className='flex gap-2'>
            <Button
              variant='contained'
              disabled={submitting || !canSubmit}
              onClick={handleSubmit}
            >
              {submitting ? 'Saving...' : submitLabel || 'Save Customer'}
            </Button>
            <Button
              variant='outlined'
              disabled={submitting}
              onClick={() => (onCancel ? onCancel() : router.push('/customers'))}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}

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
                  Taking you back to Customer list...
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
      {successDialog}
    </Box>
  )
}

export default CustomersCreateForm
