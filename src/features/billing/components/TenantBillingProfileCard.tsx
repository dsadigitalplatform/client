'use client'

import { useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

type BillingAddress = {
  line1: string
  line2: string | null
  city: string
  state: string
  stateCode: string
  pincode: string
  country: string
}

type BillingProfile = {
  legalName: string | null
  gstin: string | null
  pan: string | null
  billingEmail: string | null
  billingPhone: string | null
  billingAddress: BillingAddress | null
  placeOfSupplyStateCode: string | null
}

const emptyAddress: BillingAddress = {
  line1: '',
  line2: null,
  city: '',
  state: '',
  stateCode: '',
  pincode: '',
  country: 'IN'
}

export function TenantBillingProfileCard() {
  const [profile, setProfile] = useState<BillingProfile | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [legalName, setLegalName] = useState('')
  const [gstin, setGstin] = useState('')
  const [pan, setPan] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [billingPhone, setBillingPhone] = useState('')
  const [address, setAddress] = useState<BillingAddress>(emptyAddress)

  const applyProfile = (p: BillingProfile) => {
    setProfile(p)
    setLegalName(p.legalName || '')
    setGstin(p.gstin || '')
    setPan(p.pan || '')
    setBillingEmail(p.billingEmail || '')
    setBillingPhone(p.billingPhone || '')
    setAddress(p.billingAddress || { ...emptyAddress })
  }

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      setLoading(true)

      try {
        const res = await fetch('/api/tenant/billing-profile', { cache: 'no-store' })
        const json = await res.json()

        if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to load billing profile')
        if (cancelled) return
        setCanEdit(Boolean(json.canEdit))
        applyProfile(json.profile as BillingProfile)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load billing profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch('/api/tenant/billing-profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          legalName: legalName || null,
          gstin: gstin || null,
          pan: pan || null,
          billingEmail: billingEmail || null,
          billingPhone: billingPhone || null,
          placeOfSupplyStateCode: address.stateCode || null,
          billingAddress: address.line1
            ? {
                ...address,
                line2: address.line2 || null
              }
            : null
        })
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to save')
      applyProfile(json.profile as BillingProfile)
      setInfo('Billing profile saved — used on GST invoices')
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading && !profile) {
    return (
      <Card>
        <CardContent>
          <Typography variant='body2'>Loading billing profile…</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className='flex flex-col gap-3'>
        <Box>
          <Typography variant='h6'>GST billing details</Typography>
          <Typography variant='body2' color='text.secondary'>
            Legal name, GSTIN and address appear on tax invoices emailed after payment.
          </Typography>
        </Box>

        {error ? (
          <Alert severity='error' onClose={() => setError(null)}>
            {error}
          </Alert>
        ) : null}
        {info ? (
          <Alert severity='success' onClose={() => setInfo(null)}>
            {info}
          </Alert>
        ) : null}

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label='Legal / trade name'
              value={legalName}
              onChange={e => setLegalName(e.target.value)}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label='GSTIN'
              value={gstin}
              onChange={e => setGstin(e.target.value.toUpperCase())}
              disabled={!canEdit}
              helperText='15 characters'
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              label='PAN'
              value={pan}
              onChange={e => setPan(e.target.value.toUpperCase())}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label='Billing email'
              type='email'
              value={billingEmail}
              onChange={e => setBillingEmail(e.target.value)}
              disabled={!canEdit}
              helperText='Invoice delivery address'
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label='Billing phone'
              value={billingPhone}
              onChange={e => setBillingPhone(e.target.value)}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label='Address line 1'
              value={address.line1}
              onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label='Address line 2'
              value={address.line2 || ''}
              onChange={e => setAddress(a => ({ ...a, line2: e.target.value || null }))}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label='City'
              value={address.city}
              onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label='State'
              value={address.state}
              onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}
              disabled={!canEdit}
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              label='State code'
              value={address.stateCode}
              onChange={e => setAddress(a => ({ ...a, stateCode: e.target.value }))}
              disabled={!canEdit}
              helperText='e.g. 27'
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <TextField
              fullWidth
              label='PIN'
              value={address.pincode}
              onChange={e => setAddress(a => ({ ...a, pincode: e.target.value }))}
              disabled={!canEdit}
            />
          </Grid>
        </Grid>

        {canEdit ? (
          <Box>
            <Button variant='contained' onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save GST details'}
            </Button>
          </Box>
        ) : (
          <Alert severity='info'>Only Owner or Admin can edit GST billing details.</Alert>
        )}
      </CardContent>
    </Card>
  )
}
