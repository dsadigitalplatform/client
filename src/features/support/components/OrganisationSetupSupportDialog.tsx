'use client'

import { useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import CountryCodeField from '@/components/CountryCodeField'
import { COUNTRY_CODE_VALIDATION_MESSAGE, isValidCountryCode } from '@/lib/countryCodes'

type Props = {
    open: boolean
    onClose: () => void
    defaultFullName?: string | null
    defaultEmail?: string | null
}

const EMAIL_RE = /^.+@.+\..+$/

export default function OrganisationSetupSupportDialog({ open, onClose, defaultFullName, defaultEmail }: Props) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

    const [fullName, setFullName] = useState('')
    const [countryCode, setCountryCode] = useState('+91')
    const [mobile, setMobile] = useState('')
    const [email, setEmail] = useState('')
    const [description, setDescription] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return

        setFullName((defaultFullName || '').trim())
        setCountryCode('+91')
        setMobile('')
        setEmail((defaultEmail || '').trim())
        setDescription('')
        setError(null)
        setSuccess(null)
    }, [open, defaultFullName, defaultEmail])

    const isValidName = fullName.trim().length >= 2
    const countryCodeValid = isValidCountryCode(countryCode)
    const isValidMobile = /^[0-9]{9,10}$/.test(mobile)
    const isValidEmail = EMAIL_RE.test(email.trim())
    const isValidDescription = description.trim().length >= 10
    const canSubmit = isValidName && countryCodeValid && isValidMobile && isValidEmail && isValidDescription && !submitting

    const handleSubmit = async () => {
        if (!canSubmit) return

        setSubmitting(true)
        setError(null)
        setSuccess(null)

        try {
            const res = await fetch('/api/support/organisation-setup', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    fullName: fullName.trim(),
                    countryCode,
                    mobile,
                    email: email.trim(),
                    description: description.trim()
                })
            })

            const data = await res.json().catch(() => ({}))

            if (!res.ok || !data?.ok) {
                throw new Error(data?.error || 'Failed to submit support request')
            }

            setSuccess('Support request submitted successfully. Our team will contact you soon.')
        } catch (e: any) {
            setError(e?.message || 'Failed to submit support request')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Dialog
            open={open}
            onClose={submitting ? undefined : onClose}
            fullWidth
            maxWidth='sm'
            fullScreen={isMobile}
        >
            <DialogTitle>Contact Support</DialogTitle>
            <DialogContent
                className='flex flex-col gap-3'
                sx={{
                    px: { xs: 2, sm: 3 },
                    pb: { xs: 1.5, sm: 2 },
                    pt: { xs: 1, sm: 2 }
                }}
            >
                <Typography variant='body2' color='text.secondary'>
                    Submit this form and our team will help you set up a new organisation.
                </Typography>
                {error ? <Alert severity='error'>{error}</Alert> : null}
                {success ? <Alert severity='success'>{success}</Alert> : null}
                <TextField
                    label='Full Name'
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    error={fullName.length > 0 && !isValidName}
                    helperText={fullName.length > 0 && !isValidName ? 'Enter at least 2 characters' : ' '}
                />
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1.5, sm: 2 } }}>
                    <CountryCodeField
                        labelId='support-country-code-label'
                        value={countryCode}
                        onChange={setCountryCode}
                        error={countryCode.length > 0 && !countryCodeValid}
                        helperText={countryCode.length > 0 && !countryCodeValid ? COUNTRY_CODE_VALIDATION_MESSAGE : ' '}
                        sx={{ width: { xs: '100%', sm: 220 } }}
                    />
                    <TextField
                        label='Contact Number'
                        value={mobile}
                        onChange={e => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        required
                        fullWidth
                        inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                        error={mobile.length > 0 && !isValidMobile}
                        helperText={mobile.length > 0 && !isValidMobile ? 'Enter a valid 9 or 10-digit number' : ' '}
                    />
                </Box>
                <TextField
                    label='Email'
                    type='email'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    error={email.length > 0 && !isValidEmail}
                    helperText={email.length > 0 && !isValidEmail ? 'Enter a valid email address' : ' '}
                />
                <TextField
                    label='Description'
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                    multiline
                    minRows={3}
                    error={description.length > 0 && !isValidDescription}
                    helperText={description.length > 0 && !isValidDescription ? 'Please enter at least 10 characters' : ' '}
                    placeholder='Please describe your organisation setup requirement'
                />
            </DialogContent>
            <DialogActions
                sx={{
                    px: { xs: 2, sm: 3 },
                    pb: { xs: 2, sm: 2.5 },
                    pt: { xs: 1, sm: 1.5 },
                    flexDirection: { xs: 'column-reverse', sm: 'row' },
                    gap: { xs: 1, sm: 0 }
                }}
            >
                <Button onClick={onClose} disabled={submitting} fullWidth={isMobile}>
                    Close
                </Button>
                <Button variant='contained' onClick={handleSubmit} disabled={!canSubmit} fullWidth={isMobile}>
                    {submitting ? 'Submitting...' : 'Submit'}
                </Button>
            </DialogActions>
        </Dialog>
    )
}
