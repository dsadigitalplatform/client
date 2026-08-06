'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha, keyframes, useTheme } from '@mui/material/styles'

import { normalizeMobileDigits, isValidMobileDigits, MOBILE_VALIDATION_MESSAGE } from '@/lib/mobile'
import { createReferralInvite, getReferralSettings } from '../services/referralService'
import type { ReferralProgramSettings } from '../referrals.types'

const twinkle = keyframes`
  0%, 100% { opacity: 0.15; transform: scale(0.55) rotate(0deg); }
  40% { opacity: 1; transform: scale(1.25) rotate(18deg); }
  70% { opacity: 0.55; transform: scale(0.9) rotate(-8deg); }
`

const drift = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0); }
  50% { transform: translate3d(6px, -10px, 0); }
`

const shimmerSweep = keyframes`
  0% { transform: translateX(-140%) skewX(-14deg); }
  100% { transform: translateX(240%) skewX(-14deg); }
`

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgb(var(--mui-palette-primary-mainChannel) / 0.35); }
  50% { box-shadow: 0 0 0 12px rgb(var(--mui-palette-primary-mainChannel) / 0); }
`

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
`

const STEP_ICONS = [
  'ri-mail-send-line',
  'ri-user-shared-line',
  'ri-line-chart-line',
  'ri-wallet-3-line'
] as const

const STEP_TITLES = ['Send the invite', 'They join the platform', 'They subscribe & pay', 'You earn rewards'] as const

const STAR_LAYOUT = [
  { top: '8%', left: '12%', size: 10, delay: '0s', duration: '2.4s' },
  { top: '18%', left: '78%', size: 14, delay: '0.4s', duration: '3.1s' },
  { top: '28%', left: '42%', size: 8, delay: '1.1s', duration: '2.2s' },
  { top: '12%', left: '58%', size: 11, delay: '0.7s', duration: '2.8s' },
  { top: '55%', left: '88%', size: 9, delay: '1.5s', duration: '2.6s' },
  { top: '62%', left: '8%', size: 12, delay: '0.2s', duration: '3.4s' },
  { top: '72%', left: '68%', size: 7, delay: '1.8s', duration: '2.1s' },
  { top: '38%', left: '22%', size: 13, delay: '0.9s', duration: '2.9s' },
  { top: '48%', left: '52%', size: 6, delay: '1.3s', duration: '2.5s' },
  { top: '82%', left: '36%', size: 10, delay: '0.5s', duration: '3.2s' },
  { top: '22%', left: '92%', size: 8, delay: '2s', duration: '2.7s' },
  { top: '70%', left: '48%', size: 15, delay: '0.6s', duration: '3.6s' }
]

function GlitterStars() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        '@media (prefers-reduced-motion: reduce)': {
          display: 'none'
        }
      }}
    >
      {STAR_LAYOUT.map((star, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: star.top,
            left: star.left,
            width: star.size,
            height: star.size,
            animation: `${drift} ${star.duration} ease-in-out ${star.delay} infinite`
          }}
        >
          <Box
            component='i'
            className='ri-sparkling-2-fill'
            sx={{
              display: 'block',
              fontSize: star.size,
              color: 'common.white',
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.85))',
              animation: `${twinkle} ${star.duration} ease-in-out ${star.delay} infinite`,
              lineHeight: 1
            }}
          />
        </Box>
      ))}
    </Box>
  )
}

export default function ReferralAdPage() {
  const theme = useTheme()
  const [settings, setSettings] = useState<ReferralProgramSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await getReferralSettings()

      setSettings(res.settings)
    } catch {
      setError('Could not load referral program')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const steps = useMemo(() => {
    const benefits = settings?.benefits || []

    return [0, 1, 2, 3].map(i => ({
      icon: STEP_ICONS[i],
      title: STEP_TITLES[i],
      body: benefits[i] || STEP_TITLES[i]
    }))
  }, [settings])

  const handleInvite = async () => {
    setError(null)
    const digits = normalizeMobileDigits(mobile)

    if (!email.trim().includes('@')) {
      setError('Enter a valid email')

      return
    }

    if (!isValidMobileDigits(digits)) {
      setError(MOBILE_VALIDATION_MESSAGE)

      return
    }

    setSubmitting(true)

    try {
      await createReferralInvite({
        inviteeEmail: email.trim(),
        inviteeMobile: digits,
        inviteeName: name.trim() || undefined
      })
      setInviteOpen(false)
      setName('')
      setEmail('')
      setMobile('')
      setToast('Invite sent. The invitee and Super Admin have been notified.')
    } catch (e: any) {
      const code = e?.message || ''

      setError(
        code === 'invalid_email'
          ? 'Enter a valid email'
          : code === 'invalid_mobile'
            ? MOBILE_VALIDATION_MESSAGE
            : code === 'no_tenant'
              ? 'Select an organisation first'
              : 'Failed to send invite'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!settings) {
    return <Alert severity='error'>Referral program is unavailable.</Alert>
  }

  const heroGradient =
    theme.palette.mode === 'dark'
      ? `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.42)} 0%, ${alpha(theme.palette.background.paper, 0.96)} 52%, ${alpha(theme.palette.secondary.main, 0.28)} 100%)`
      : `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.96)} 0%, ${alpha(theme.palette.primary.dark, 0.88)} 48%, ${alpha(theme.palette.info.main, 0.62)} 100%)`

  return (
    <Box sx={{ position: 'relative', pb: { xs: 10, sm: 4 } }}>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: { xs: 0, sm: 4 },
          mx: { xs: -2, sm: 0 },
          minHeight: { xs: '68vh', sm: 440 },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          px: { xs: 2.5, sm: 5 },
          py: { xs: 4, sm: 5 },
          background: heroGradient,
          color: 'common.white',
          boxShadow: {
            xs: 'none',
            sm: `0 24px 56px ${alpha(theme.palette.primary.main, 0.32)}`
          }
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 18% 12%, ${alpha('#fff', 0.28)} 0%, transparent 42%), radial-gradient(ellipse at 88% 70%, ${alpha(theme.palette.primary.light, 0.35)} 0%, transparent 48%)`,
            pointerEvents: 'none'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
            '@media (prefers-reduced-motion: reduce)': { display: 'none' }
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '42%',
              background: `linear-gradient(90deg, transparent, ${alpha('#fff', 0.18)}, transparent)`,
              animation: `${shimmerSweep} 5.5s ease-in-out infinite`
            }}
          />
        </Box>
        <GlitterStars />

        <Box sx={{ position: 'relative', zIndex: 1, animation: `${riseIn} 0.6s ease-out` }}>
          <Chip
            icon={<i className='ri-sparkling-2-line' style={{ fontSize: 16, marginLeft: 8 }} />}
            label={`${settings.commissionPercent}% recurring commission`}
            sx={{
              alignSelf: 'flex-start',
              mb: 2,
              bgcolor: alpha('#fff', 0.16),
              color: 'inherit',
              fontWeight: 700,
              border: `1px solid ${alpha('#fff', 0.28)}`,
              backdropFilter: 'blur(8px)',
              '& .MuiChip-icon': { color: 'inherit' },
              animation: `${pulseGlow} 2.8s ease-in-out infinite`,
              '@media (prefers-reduced-motion: reduce)': { animation: 'none' }
            }}
          />
          <Typography
            variant='overline'
            sx={{ letterSpacing: 2.4, fontWeight: 800, opacity: 0.92, mb: 0.5, display: 'block' }}
          >
            Refer &amp; Earn
          </Typography>
          <Typography
            variant='h3'
            sx={{
              fontWeight: 800,
              fontSize: { xs: '1.9rem', sm: '2.85rem' },
              lineHeight: 1.12,
              maxWidth: 640,
              mb: 1.5,
              textShadow: `0 8px 28px ${alpha(theme.palette.common.black, 0.25)}`
            }}
          >
            {settings.headline}
          </Typography>
          <Typography
            sx={{
              maxWidth: 540,
              opacity: 0.94,
              mb: 3.5,
              fontSize: { xs: '0.98rem', sm: '1.08rem' },
              lineHeight: 1.55
            }}
          >
            {settings.subheadline}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            <Button
              variant='contained'
              size='large'
              onClick={() => setInviteOpen(true)}
              startIcon={<i className='ri-user-add-line' />}
              sx={{
                bgcolor: 'common.white',
                color: 'primary.main',
                fontWeight: 800,
                px: 3,
                boxShadow: `0 10px 28px ${alpha(theme.palette.common.black, 0.18)}`,
                '&:hover': {
                  bgcolor: alpha('#fff', 0.92),
                  color: 'primary.dark'
                },
                display: { xs: 'none', sm: 'inline-flex' }
              }}
            >
              {settings.ctaLabel}
            </Button>
            <Button
              component={Link}
              href='/rewards'
              variant='outlined'
              size='large'
              startIcon={<i className='ri-medal-line' />}
              sx={{
                borderColor: alpha('#fff', 0.55),
                color: 'common.white',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#fff',
                  bgcolor: alpha('#fff', 0.1)
                }
              }}
            >
              View Rewards
            </Button>
          </Box>
        </Box>
      </Box>

      <Box sx={{ mt: { xs: 4, sm: 5 } }}>
        <Box sx={{ mb: 2.5, display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant='h5' sx={{ fontWeight: 800 }}>
            How it works
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Four steps from invite to payout
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: { xs: 2, sm: 2.5 },
            position: 'relative'
          }}
        >
          {steps.map((step, i) => (
            <Box
              key={step.title}
              sx={{
                position: 'relative',
                borderRadius: 3,
                p: { xs: 2.25, sm: 2.75 },
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                backgroundImage: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.14 : 0.06)} 0%, transparent 55%)`,
                boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.08)}`,
                transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                animation: `${riseIn} 0.55s ease-out ${0.08 * i}s both`,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 18px 40px ${alpha(theme.palette.primary.main, 0.16)}`,
                  borderColor: alpha(theme.palette.primary.main, 0.45)
                },
                '@media (prefers-reduced-motion: reduce)': {
                  animation: 'none',
                  '&:hover': { transform: 'none' }
                }
              }}
            >
              <Typography
                aria-hidden
                sx={{
                  position: 'absolute',
                  right: 10,
                  top: -6,
                  fontSize: { xs: '4.5rem', sm: '5.5rem' },
                  fontWeight: 900,
                  lineHeight: 1,
                  color: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.08),
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', position: 'relative' }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2.5,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'primary.contrastText',
                    background: `linear-gradient(145deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                    boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                    fontSize: 26
                  }}
                >
                  <i className={step.icon} />
                </Box>
                <Box sx={{ minWidth: 0, pt: 0.25 }}>
                  <Chip
                    size='small'
                    label={`Step ${i + 1}`}
                    sx={{
                      mb: 1,
                      height: 22,
                      fontWeight: 700,
                      bgcolor: alpha(theme.palette.primary.main, 0.12),
                      color: 'primary.main'
                    }}
                  />
                  <Typography variant='h6' sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 0.75, lineHeight: 1.3 }}>
                    {step.title}
                  </Typography>
                  <Typography variant='body2' color='text.secondary' sx={{ lineHeight: 1.55 }}>
                    {step.body}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Accordion
        disableGutters
        elevation={0}
        sx={{
          mt: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '14px !important',
          overflow: 'hidden',
          '&:before': { display: 'none' }
        }}
      >
        <AccordionSummary expandIcon={<i className='ri-arrow-down-s-line' />}>
          <Typography fontWeight={700}>Terms &amp; conditions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box
            sx={{
              typography: 'body2',
              color: 'text.secondary',
              '& p': { m: 0, mb: 1 }
            }}
            dangerouslySetInnerHTML={{ __html: settings.termsHtml }}
          />
        </AccordionDetails>
      </Accordion>

      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 20,
          p: 2,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          display: { xs: 'block', sm: 'none' }
        }}
      >
        <Button
          fullWidth
          variant='contained'
          size='large'
          onClick={() => setInviteOpen(true)}
          startIcon={<i className='ri-user-add-line' />}
          sx={{ fontWeight: 800 }}
        >
          {settings.ctaLabel}
        </Button>
      </Box>

      <Dialog open={inviteOpen} onClose={() => (!submitting ? setInviteOpen(false) : undefined)} fullWidth maxWidth='xs'>
        <DialogTitle>Invite a DSA</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            We email the invitee a signup link and notify Super Admin with their contact details so they can help
            onboard.
          </Typography>
          {error ? <Alert severity='error'>{error}</Alert> : null}
          <TextField label='Name (optional)' value={name} onChange={e => setName(e.target.value)} fullWidth />
          <TextField
            label='Email'
            type='email'
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label='Mobile'
            required
            value={mobile}
            onChange={e => setMobile(normalizeMobileDigits(e.target.value))}
            helperText={MOBILE_VALIDATION_MESSAGE}
            fullWidth
            inputProps={{ inputMode: 'numeric' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void handleInvite()} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send invite'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(toast)} autoHideDuration={5000} onClose={() => setToast(null)} message={toast} />
    </Box>
  )
}
