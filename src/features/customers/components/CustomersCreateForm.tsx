'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import Slider from '@mui/material/Slider'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Divider from '@mui/material/Divider'
import InputAdornment from '@mui/material/InputAdornment'

import { createCustomer } from '@features/customers/services/customersService'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
  initialValues?: Partial<{
    fullName: string
    mobile: string
    email: string | null
    dob: string | null
    pan: string | null
    aadhaarMasked: string | null
    address: string | null
    employmentType: 'SALARIED' | 'SELF_EMPLOYED'
    source: 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'
    monthlyIncome: number | null
    cibilScore: number | null
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
}

const CustomersCreateForm = ({ onSuccess, onCancel, showTitle = true, initialValues, onSubmitOverride, submitLabel }: Props) => {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [dob, setDob] = useState('')
  const [pan, setPan] = useState('')
  const [aadhaarMasked, setAadhaarMasked] = useState('')
  const [address, setAddress] = useState('')
  const [employmentType, setEmploymentType] = useState<'SALARIED' | 'SELF_EMPLOYED'>('SALARIED')
  const [source, setSource] = useState<'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'>('WALK_IN')
  const [monthlyIncome, setMonthlyIncome] = useState<string>('')
  const [cibilScore, setCibilScore] = useState<string>('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!initialValues) return
    if (initialValues.fullName != null) setFullName(initialValues.fullName)
    if (initialValues.mobile != null) setMobile(initialValues.mobile)
    if (initialValues.email !== undefined) setEmail(initialValues.email || '')
    if (initialValues.dob != null) setDob(initialValues.dob ? initialValues.dob.slice(0, 10) : '')
    if (initialValues.pan !== undefined) setPan(initialValues.pan || '')
    if (initialValues.aadhaarMasked !== undefined) setAadhaarMasked(initialValues.aadhaarMasked || '')
    if (initialValues.address !== undefined) setAddress(initialValues.address || '')
    if (initialValues.employmentType) setEmploymentType(initialValues.employmentType)
    if (initialValues.source) setSource(initialValues.source)
    if (initialValues.monthlyIncome !== undefined && initialValues.monthlyIncome !== null)
      setMonthlyIncome(String(initialValues.monthlyIncome))
    if (initialValues.cibilScore !== undefined && initialValues.cibilScore !== null)
      setCibilScore(String(initialValues.cibilScore))
  }, [initialValues])

  // basic client-side validators
  const isValidMobile = (v: string) => /^[0-9]{10}$/.test(v)
  const isValidEmail = (v: string) => !v || /^.+@.+\..+$/.test(v)
  const isValidPAN = (v: string) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v)
  const isValidCibil = (v: string) => !v || (/^\d+$/.test(v) && Number(v) >= 300 && Number(v) <= 900)

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      isValidMobile(mobile) &&
      isValidEmail(email) &&
      isValidPAN(pan) &&
      isValidCibil(cibilScore)
    )
  }, [fullName, mobile, email, pan, cibilScore])

  // input normalizers
  const handleMobile = (v: string) => {
    setMobile(v.replace(/\D/g, '').slice(0, 10))
  }

  const handlePAN = (v: string) => {
    setPan(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))
  }

  const handleAadhaar = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(-12)

    if (digits.length < 4) {
      setAadhaarMasked('')
      
return
    }

    const last4 = digits.slice(-4)

    setAadhaarMasked(`XXXX-XXXX-${last4}`)
  }

  const handleSubmit = async () => {
    setError(null)
    setFieldErrors({})
    setSubmitting(true)

    try {
      const payload = {
        fullName: fullName.trim(),
        mobile,
        email: email ? email.trim() : null,
        dob: dob ? new Date(dob).toISOString() : null,
        pan: pan ? pan.toUpperCase() : null,
        aadhaarMasked: aadhaarMasked || null,
        address: address || null,
        employmentType,
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : null,
        cibilScore: cibilScore ? Number(cibilScore) : null,
        source
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        await createCustomer(payload)
      }

      setFullName('')
      setMobile('')
      setEmail('')
      setDob('')
      setPan('')
      setAadhaarMasked('')
      setAddress('')
      setEmploymentType('SALARIED')
      setSource('WALK_IN')
      setMonthlyIncome('')
      setCibilScore('')
      setFieldErrors({})
      setError(null)
      if (onSuccess) onSuccess()
      else router.push('/customers')
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to create customer')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title='Add Customer' subheader='Enter customer details to create a new record' /> : null}
      <CardContent>
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={3}>
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
              )
            }}
          />

          <TextField
            label='Mobile'
            value={mobile}
            onChange={e => handleMobile(e.target.value)}
            error={Boolean(fieldErrors.mobile) || (mobile.length > 0 && !isValidMobile(mobile))}
            helperText={
              fieldErrors.mobile || (mobile.length > 0 && !isValidMobile(mobile) ? 'Enter a 10-digit mobile number' : ' ')
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
            fullWidth
            placeholder='XXXX-XXXX-1234'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-shield-keyhole-line' />
                </InputAdornment>
              )
            }}
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

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 2 }}>
            <TextField
              label='CIBIL Score'
              value={cibilScore}
              onChange={e => setCibilScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
              error={!!fieldErrors.cibilScore}
              helperText={fieldErrors.cibilScore}
              placeholder='300–900'
              sx={{ width: 160 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='ri-speed-up-line' />
                  </InputAdornment>
                )
              }}
            />
            <Box sx={{ flex: 1, px: 2 }}>
              <Slider
                min={300}
                max={900}
                step={1}
                value={Number(cibilScore || '650')}
                onChange={(_, v) => setCibilScore(String(v as number))}
                valueLabelDisplay='auto'
                sx={{ mt: 1 }}
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
      </CardContent>
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
    </Card>
  )
}

export default CustomersCreateForm
