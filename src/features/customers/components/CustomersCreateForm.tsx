'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'

import { createCustomer } from '@features/customers/services/customersService'

type Props = {
  onSuccess?: () => void
  onCancel?: () => void
  showTitle?: boolean
}

const CustomersCreateForm = ({ onSuccess, onCancel, showTitle = true }: Props) => {
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
    // call API service and handle server-side validation errors
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
      await createCustomer(payload)
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
    <Box className='flex flex-col gap-4'>
      {showTitle ? <Typography variant='h4'>Add Customer</Typography> : null}
      {error ? <Alert severity='error'>{error}</Alert> : null}
      <Stack spacing={2}>
        <TextField
          label='Full Name'
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          error={!!fieldErrors.fullName}
          helperText={fieldErrors.fullName}
          fullWidth
          required
        />

        <TextField
          label='Mobile'
          value={mobile}
          onChange={e => handleMobile(e.target.value)}
          error={!!fieldErrors.mobile}
          helperText={fieldErrors.mobile || '10 digit number'}
          fullWidth
          required
          inputProps={{ inputMode: 'numeric' }}
        />

        <TextField
          label='Email'
          value={email}
          onChange={e => setEmail(e.target.value)}
          error={!!fieldErrors.email}
          helperText={fieldErrors.email}
          fullWidth
        />

        <TextField
          label='Date of Birth'
          type='date'
          value={dob}
          onChange={e => setDob(e.target.value)}
          fullWidth
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label='PAN'
          value={pan}
          onChange={e => handlePAN(e.target.value)}
          error={!!fieldErrors.pan}
          helperText={fieldErrors.pan || 'Uppercase, e.g., ABCDE1234F'}
          fullWidth
        />

        <TextField
          label='Aadhaar (masked)'
          value={aadhaarMasked}
          onChange={e => handleAadhaar(e.target.value)}
          fullWidth
          placeholder='XXXX-XXXX-1234'
        />

        <TextField
          label='Address'
          value={address}
          onChange={e => setAddress(e.target.value)}
          fullWidth
          multiline
          minRows={2}
        />

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

        <TextField
          label='Monthly Income'
          value={monthlyIncome}
          onChange={e => setMonthlyIncome(e.target.value.replace(/[^\d.]/g, ''))}
          fullWidth
          placeholder='Optional'
        />

        <TextField
          label='CIBIL Score'
          value={cibilScore}
          onChange={e => setCibilScore(e.target.value.replace(/\D/g, '').slice(0, 3))}
          error={!!fieldErrors.cibilScore}
          helperText={fieldErrors.cibilScore}
          fullWidth
          placeholder='300–900'
        />
      </Stack>
      <Box className='flex gap-2'>
        <Button
          variant='contained'
          disabled={submitting || !canSubmit}
          onClick={handleSubmit}
        >
          {submitting ? 'Saving...' : 'Save Customer'}
        </Button>
        <Button variant='outlined' disabled={submitting} onClick={() => (onCancel ? onCancel() : router.push('/customers'))}>
          Cancel
        </Button>
      </Box>
    </Box>
  )
}

export default CustomersCreateForm
