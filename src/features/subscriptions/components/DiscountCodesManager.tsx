'use client'

import { useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, formatPlanMoney } from '@features/subscription-plans/currencies'
import type { DiscountCode, DiscountDuration, DiscountScope, DiscountType } from '@features/subscriptions/subscriptions.types'

type PlanOption = { _id: string; name: string; priceMonthly: number; currency: string; isActive?: boolean }
type TenantOption = { _id: string; name: string }

type FormState = {
  code: string
  name: string
  description: string
  type: DiscountType
  value: string
  currency: string
  scope: DiscountScope
  duration: DiscountDuration
  durationMonths: string
  validFrom: string
  validTo: string
  maxRedemptions: string
  planIds: string[]
  tenantIds: string[]
}

const emptyForm = (): FormState => {
  const from = new Date()
  const to = new Date()

  to.setMonth(to.getMonth() + 1)

  return {
    code: '',
    name: '',
    description: '',
    type: 'percent',
    value: '100',
    currency: DEFAULT_CURRENCY,
    scope: 'global',
    duration: 'once',
    durationMonths: '3',
    validFrom: from.toISOString().slice(0, 10),
    validTo: to.toISOString().slice(0, 10),
    maxRedemptions: '',
    planIds: [],
    tenantIds: []
  }
}

export function DiscountCodesManager() {
  const [discounts, setDiscounts] = useState<DiscountCode[]>([])
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm())

  const planById = useMemo(() => new Map(plans.map(p => [p._id, p])), [plans])
  const tenantById = useMemo(() => new Map(tenants.map(t => [t._id, t])), [tenants])

  const loadLookups = async () => {
    const [plansRes, tenantsRes] = await Promise.all([
      fetch('/api/super-admin/subscription-plans', { cache: 'no-store' }),
      fetch('/api/super-admin/tenants?lite=1', { cache: 'no-store' })
    ])

    const plansJson = await plansRes.json().catch(() => ({}))
    const tenantsJson = await tenantsRes.json().catch(() => ({}))

    if (plansRes.ok) {
      setPlans(
        (plansJson.plans || []).map((p: any) => ({
          _id: String(p._id),
          name: String(p.name || ''),
          priceMonthly: Number(p.priceMonthly) || 0,
          currency: String(p.currency || DEFAULT_CURRENCY),
          isActive: p.isActive !== false
        }))
      )
    }

    if (tenantsRes.ok) {
      setTenants(
        (tenantsJson.tenants || []).map((t: any) => ({
          _id: String(t._id),
          name: String(t.name || '')
        }))
      )
    }
  }

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/super-admin/discount-codes', { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load discount codes')
      setDiscounts(data.discounts || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load discount codes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void loadLookups()
  }, [])

  const openCreate = () => {
    setFormError(null)
    setForm(emptyForm())
    setOpen(true)
    void loadLookups()
  }

  const submit = async () => {
    const scope = form.scope
    const planIds = scope === 'plan' ? form.planIds : []
    const tenantIds = scope === 'tenant' ? form.tenantIds : []

    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Code and name are required.')

      return
    }

    if (scope === 'plan' && planIds.length === 0) {
      setFormError('Select at least one plan for plan-level codes.')

      return
    }

    if (scope === 'tenant' && tenantIds.length === 0) {
      setFormError('Select at least one organisation for tenant-level codes.')

      return
    }

    const payload = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      description: form.description.trim(),
      type: form.type,
      value: Number(form.value),
      currency: form.type === 'fixed' ? form.currency : null,
      scope,
      duration: form.duration,
      durationMonths: form.duration === 'repeating' ? Number(form.durationMonths) : null,
      validFrom: new Date(form.validFrom).toISOString(),
      validTo: new Date(form.validTo).toISOString(),
      maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
      planIds,
      tenantIds
    }

    setSaving(true)
    setFormError(null)

    try {
      const res = await fetch('/api/super-admin/discount-codes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to create discount')
      setOpen(false)
      setForm(emptyForm())
      await load()
    } catch (e: any) {
      setFormError(e?.message || 'Failed to create discount')
    } finally {
      setSaving(false)
    }
  }

  const deactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/super-admin/discount-codes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: false })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))

        throw new Error(data?.message || data?.error || 'Failed to update')
      }

      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to update')
    }
  }

  const scopeSummary = (d: DiscountCode) => {
    if (d.scope === 'global') return 'All organisations & plans'

    if (d.scope === 'plan') {
      const names = (d.planIds || []).map(id => planById.get(id)?.name || id.slice(-6))

      return names.length ? `Plans: ${names.join(', ')}` : 'Plans: (none)'
    }

    const names = (d.tenantIds || []).map(id => tenantById.get(id)?.name || id.slice(-6))

    return names.length ? `Orgs: ${names.join(', ')}` : 'Orgs: (none)'
  }

  const selectedPlans = plans.filter(p => form.planIds.includes(p._id))
  const selectedTenants = tenants.filter(t => form.tenantIds.includes(t._id))

  return (
    <Box className='flex flex-col gap-4'>
      <Box className='flex items-center justify-between gap-2 flex-wrap'>
        <Box>
          <Typography variant='h5'>Discount codes</Typography>
          <Typography variant='body2' color='text.secondary'>
            Global, plan-scoped, or organisation-scoped promos. For a free trial promo, use 100% off.
          </Typography>
        </Box>
        <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={openCreate}>
          Create code
        </Button>
      </Box>

      {error ? (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {loading && discounts.length === 0 ? <Typography>Loading…</Typography> : null}

      <Box className='grid grid-cols-1 md:grid-cols-2 gap-3'>
        {discounts.map(d => (
          <Card key={d._id} variant='outlined'>
            <CardContent className='flex flex-col gap-2'>
              <Box className='flex items-center justify-between gap-2'>
                <Typography variant='h6'>{d.code}</Typography>
                <Chip size='small' label={d.isActive ? 'Active' : 'Inactive'} color={d.isActive ? 'success' : 'default'} />
              </Box>
              <Typography variant='body2'>{d.name}</Typography>
              <Typography variant='body2' color='text.secondary'>
                {d.type === 'percent' ? `${d.value}% off` : `${d.value} ${d.currency} off`} · {d.duration}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {scopeSummary(d)}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Valid {d.validFrom.slice(0, 10)} → {d.validTo.slice(0, 10)} · Redeemed {d.redemptionCount}
                {d.maxRedemptions != null ? ` / ${d.maxRedemptions}` : ''}
              </Typography>
              {d.isActive ? (
                <Button size='small' color='warning' variant='outlined' onClick={() => deactivate(d._id)}>
                  Deactivate
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </Box>

      <Dialog open={open} onClose={() => (!saving ? setOpen(false) : undefined)} fullWidth maxWidth='sm'>
        <DialogTitle>Create discount code</DialogTitle>
        <DialogContent className='flex flex-col gap-3 pt-2'>
          <Alert severity='info'>
            For a free promo, set type to Percent and value to 100. Global applies to everyone; otherwise pick plans or
            organisations.
          </Alert>
          {formError ? <Alert severity='error'>{formError}</Alert> : null}
          <TextField label='Code' value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} fullWidth />
          <TextField label='Name' value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} fullWidth />
          <TextField
            label='Description'
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            fullWidth
          />
          <Box className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label='Type'
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as DiscountType }))}
              >
                <MenuItem value='percent'>Percent</MenuItem>
                <MenuItem value='fixed'>Fixed amount</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label='Value'
              type='number'
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              fullWidth
              helperText={form.type === 'percent' ? 'Use 100 for free' : undefined}
            />
          </Box>
          {form.type === 'fixed' ? (
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select
                label='Currency'
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: String(e.target.value) }))}
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : null}
          <FormControl fullWidth>
            <InputLabel>Scope</InputLabel>
            <Select
              label='Scope'
              value={form.scope}
              onChange={e => {
                const scope = e.target.value as DiscountScope

                setForm(f => ({
                  ...f,
                  scope,
                  planIds: scope === 'plan' ? f.planIds : [],
                  tenantIds: scope === 'tenant' ? f.tenantIds : []
                }))
              }}
            >
              <MenuItem value='global'>Global (all organisations & plans)</MenuItem>
              <MenuItem value='plan'>Plan-level</MenuItem>
              <MenuItem value='tenant'>Organisation-level</MenuItem>
            </Select>
          </FormControl>
          {form.scope === 'plan' ? (
            <Autocomplete
              multiple
              options={plans}
              value={selectedPlans}
              onChange={(_, value) => setForm(f => ({ ...f, planIds: value.map(p => p._id) }))}
              getOptionLabel={o =>
                `${o.name} · ${formatPlanMoney(o.priceMonthly, o.currency)}${o.isActive === false ? ' (inactive)' : ''}`
              }
              isOptionEqualToValue={(a, b) => a._id === b._id}
              renderInput={params => <TextField {...params} label='Plans' placeholder='Select plans' />}
            />
          ) : null}
          {form.scope === 'tenant' ? (
            <Autocomplete
              multiple
              options={tenants}
              value={selectedTenants}
              onChange={(_, value) => setForm(f => ({ ...f, tenantIds: value.map(t => t._id) }))}
              getOptionLabel={o => o.name}
              isOptionEqualToValue={(a, b) => a._id === b._id}
              renderInput={params => <TextField {...params} label='Organisations' placeholder='Select organisations' />}
            />
          ) : null}
          <Box className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
            <TextField
              label='Valid from'
              type='date'
              InputLabelProps={{ shrink: true }}
              value={form.validFrom}
              onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))}
              fullWidth
            />
            <TextField
              label='Valid to'
              type='date'
              InputLabelProps={{ shrink: true }}
              value={form.validTo}
              onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))}
              fullWidth
            />
          </Box>
          <FormControl fullWidth>
            <InputLabel>Duration</InputLabel>
            <Select
              label='Duration'
              value={form.duration}
              onChange={e => setForm(f => ({ ...f, duration: e.target.value as DiscountDuration }))}
            >
              <MenuItem value='once'>Once</MenuItem>
              <MenuItem value='repeating'>Repeating</MenuItem>
              <MenuItem value='forever'>Forever</MenuItem>
            </Select>
          </FormControl>
          {form.duration === 'repeating' ? (
            <TextField
              label='Duration months'
              type='number'
              value={form.durationMonths}
              onChange={e => setForm(f => ({ ...f, durationMonths: e.target.value }))}
              fullWidth
            />
          ) : null}
          <TextField
            label='Max redemptions (optional)'
            type='number'
            value={form.maxRedemptions}
            onChange={e => setForm(f => ({ ...f, maxRedemptions: e.target.value }))}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={submit} disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
