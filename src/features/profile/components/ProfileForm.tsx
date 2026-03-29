'use client'

import { useEffect, useState } from 'react'

import Avatar from '@mui/material/Avatar'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Checkbox from '@mui/material/Checkbox'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import { updateProfile } from '../services/profileService'
import { useProfile } from '../hooks/useProfile'
import type { UpdateProfileInput } from '../profile.types'

const COUNTRY_CODE_OPTIONS = [
  { code: '+91', iso: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+1', iso: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+65', iso: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+61', iso: 'AU', name: 'Australia', flag: '🇦🇺' }
] as const

const isValidCountryCode = (value: string) => /^\+[0-9]{1,4}$/.test(value)
const isValidMobile = (value: string) => /^[0-9]{9,10}$/.test(value)

const ProfileForm = () => {
  const { profile, loading, error, refresh } = useProfile()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [image, setImage] = useState('')
  const [countryCode, setCountryCode] = useState('+91')
  const [mobile, setMobile] = useState('')
  const [notifyMe, setNotifyMe] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!profile) return
    setName(profile.name || '')
    setEmail(profile.email || '')
    setImage(profile.image || '')
    setCountryCode(profile.countryCode || '+91')
    setMobile(profile.mobile || '')
    setNotifyMe(Boolean(profile.notifyMe))
  }, [profile])

  const validate = () => {
    const errors: Record<string, string> = {}

    if (name.trim().length < 2) errors.name = 'Enter at least 2 characters'

    if (countryCode && !isValidCountryCode(countryCode)) errors.countryCode = 'Invalid country code'

    if (mobile && !isValidMobile(mobile)) errors.mobile = 'Enter a 9 or 10-digit mobile number'

    setFieldErrors(errors)

    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    setFormError(null)
    setSuccessMsg(null)

    if (!validate()) return

    setSubmitting(true)

    const payload: UpdateProfileInput = {
      name: name.trim(),
      image: image.trim().length ? image.trim() : null,
      countryCode: countryCode.trim().length ? countryCode.trim() : null,
      mobile: mobile.trim().length ? mobile.trim() : null,
      notifyMe
    }

    try {
      await updateProfile(payload)
      await refresh()
      setSuccessMsg('Profile updated')
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card
      sx={{
        borderRadius: { xs: 4, sm: 3 },
        boxShadow: isMobile ? 'none' : 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))',
        border: isMobile ? '1px solid' : 'none',
        borderColor: isMobile ? 'divider' : 'transparent'
      }}
    >
      <CardHeader title='My Profile' subheader='Update your profile information' />
      {loading ? <LinearProgress /> : null}
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Stack spacing={2.5}>
          {error ? <Alert severity='error'>{error}</Alert> : null}
          {formError ? <Alert severity='error'>{formError}</Alert> : null}
          {successMsg ? <Alert severity='success'>{successMsg}</Alert> : null}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
              <Avatar
                src={image || profile?.image || '/images/avatars/1.png'}
                alt={name || 'User'}
                sx={{ width: 72, height: 72 }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                  Profile Picture
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Paste a URL to override your Google photo
                </Typography>
              </Box>
            </Box>
            <TextField
              fullWidth
              label='Profile Picture URL'
              value={image}
              onChange={e => setImage(e.target.value)}
              placeholder='https://...'
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label='Full Name'
              value={name}
              onChange={e => setName(e.target.value)}
              error={Boolean(fieldErrors.name)}
              helperText={fieldErrors.name}
            />
            <TextField fullWidth label='Email' value={email} disabled />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth error={Boolean(fieldErrors.countryCode)}>
              <InputLabel id='profile-country-code'>Country Code</InputLabel>
              <Select
                labelId='profile-country-code'
                label='Country Code'
                value={countryCode}
                onChange={e => setCountryCode(String(e.target.value))}
              >
                {COUNTRY_CODE_OPTIONS.map(option => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.flag} {option.name} ({option.code})
                  </MenuItem>
                ))}
              </Select>
              {fieldErrors.countryCode ? (
                <Typography variant='caption' color='error'>
                  {fieldErrors.countryCode}
                </Typography>
              ) : null}
            </FormControl>
            <TextField
              fullWidth
              label='Mobile Number'
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              error={Boolean(fieldErrors.mobile)}
              helperText={fieldErrors.mobile || ' '}
              placeholder='Enter 9 or 10-digit number'
            />
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                Notifications
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Receive updates and reminders
              </Typography>
            </Box>
            <FormControlLabel
              control={<Checkbox checked={notifyMe} onChange={e => setNotifyMe(e.target.checked)} />}
              label='Notify me'
            />
          </Box>
        </Stack>
      </CardContent>
      <CardActions sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
        <Button
          variant='contained'
          onClick={handleSubmit}
          disabled={submitting || loading}
          fullWidth={isMobile}
        >
          {submitting ? 'Saving…' : 'Save Changes'}
        </Button>
      </CardActions>
    </Card>
  )
}

export default ProfileForm
