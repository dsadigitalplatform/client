'use client'

import { useCallback, useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'

import { getReferralSettings, updateReferralSettings } from '../../services/referralService'
import type { ReferralProgramSettings } from '../../referrals.types'

export default function ReferralProgramSettingsForm() {
  const [settings, setSettings] = useState<ReferralProgramSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [benefitsText, setBenefitsText] = useState('')

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await getReferralSettings()

      setSettings(res.settings)
      setBenefitsText((res.settings.benefits || []).join('\n'))
    } catch {
      setError('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError(null)

    try {
      const res = await updateReferralSettings({
        commissionPercent: Number(settings.commissionPercent),
        headline: settings.headline,
        subheadline: settings.subheadline,
        benefits: benefitsText
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean),
        termsHtml: settings.termsHtml,
        ctaLabel: settings.ctaLabel
      })

      setSettings(res.settings)
      setBenefitsText((res.settings.benefits || []).join('\n'))
      setToast('Referral program saved')
    } catch (e: any) {
      setError(e?.data?.message || e?.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!settings) return <Alert severity='error'>Settings unavailable</Alert>

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, maxWidth: 800 }}>
      <Typography variant='body2' color='text.secondary'>
        Controls the Refer &amp; Earn ad page content and the default recurring commission percentage. You can override
        or cancel commission per referral in Referrals.
      </Typography>
      {error ? <Alert severity='error'>{error}</Alert> : null}

      <TextField
        label='Commission %'
        type='number'
        value={settings.commissionPercent}
        onChange={e => setSettings({ ...settings, commissionPercent: Number(e.target.value) })}
        inputProps={{ min: 0, max: 100, step: 0.5 }}
        sx={{ maxWidth: 200 }}
      />
      <TextField
        label='Headline'
        value={settings.headline}
        onChange={e => setSettings({ ...settings, headline: e.target.value })}
        fullWidth
      />
      <TextField
        label='Subheadline'
        value={settings.subheadline}
        onChange={e => setSettings({ ...settings, subheadline: e.target.value })}
        fullWidth
        multiline
        minRows={2}
      />
      <TextField
        label='CTA label'
        value={settings.ctaLabel}
        onChange={e => setSettings({ ...settings, ctaLabel: e.target.value })}
        sx={{ maxWidth: 280 }}
      />
      <TextField
        label='Benefits (one per line)'
        value={benefitsText}
        onChange={e => setBenefitsText(e.target.value)}
        fullWidth
        multiline
        minRows={4}
      />
      <TextField
        label='Terms & conditions (HTML allowed)'
        value={settings.termsHtml}
        onChange={e => setSettings({ ...settings, termsHtml: e.target.value })}
        fullWidth
        multiline
        minRows={5}
        helperText='State that Super Admin may modify or cancel commission at any time.'
      />

      <Card variant='outlined' sx={{ borderRadius: 3, bgcolor: 'action.hover' }}>
        <CardContent>
          <Typography variant='overline' fontWeight={700}>
            Preview
          </Typography>
          <Typography variant='h5' fontWeight={800}>
            {settings.headline}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
            {settings.subheadline}
          </Typography>
          <Typography variant='caption' display='block' sx={{ mt: 1.5 }}>
            {settings.commissionPercent}% · {settings.ctaLabel}
          </Typography>
        </CardContent>
      </Card>

      <Button variant='contained' onClick={() => void save()} disabled={saving} sx={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : 'Save settings'}
      </Button>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        message={toast}
        action={
          <IconButton size='small' color='inherit' onClick={() => setToast(null)}>
            <i className='ri-close-line' />
          </IconButton>
        }
      />
    </Box>
  )
}
