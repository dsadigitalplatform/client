'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'

import type { SubscriptionPlan } from '../subscription-plans.types'
import { DEFAULT_CURRENCY, SUPPORTED_CURRENCIES, formatPlanMoney, normalizeCurrency } from '../currencies'
import {
  TRIAL_DAYS,
  UNLIMITED,
  defaultPlanEntitlements,
  isMonthlyLimit,
  normalizePlanEntitlements,
  type LimitFeatureKey,
  type PlanEntitlements
} from '../featureCatalog'
import { subscriptionPlansService } from '../services/subscriptionPlansService'
import { PlanEntitlementsEditor } from './PlanEntitlementsEditor'

type FormState = {
  id?: string
  name: string
  slug: string
  description: string
  priceMonthly: string
  priceYearly?: string
  currency: string
  trialEnabled: boolean
  trialDays: string
  isRecommended: boolean
  isActive: boolean
  entitlements: PlanEntitlements
}

export const SubscriptionPlansManager = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [impactOpen, setImpactOpen] = useState(false)
  const [impactMessages, setImpactMessages] = useState<string[]>([])
  const [impactLoading, setImpactLoading] = useState(false)
  const [pendingSave, setPendingSave] = useState<{
    name: string
    slug: string
    description: string
    priceMonthly: number
    priceYearly?: number
    currency: string
    maxUsers: number
    trialEnabled: boolean
    trialDays: number
    isDefault: boolean
    isActive: boolean
    entitlements: PlanEntitlements
    features: Record<string, boolean>
    id?: string
  } | null>(null)

  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const [form, setForm] = useState<FormState>({
    name: '',
    slug: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    currency: DEFAULT_CURRENCY,
    trialEnabled: true,
    trialDays: String(TRIAL_DAYS),
    isRecommended: false,
    isActive: true,
    entitlements: defaultPlanEntitlements()
  })

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isEdit = useMemo(() => Boolean(form.id), [form.id])

  const slugify = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64)

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await subscriptionPlansService.list()

      setPlans(
        (res.plans || []).map(p => ({
          ...p,
          _id: typeof p._id === 'string' ? p._id : String(p._id)
        }))
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to load plans')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setFormError(null)
    setForm({
      name: '',
      slug: '',
      description: '',
      priceMonthly: '',
      priceYearly: '',
      currency: DEFAULT_CURRENCY,
      trialEnabled: true,
      trialDays: String(TRIAL_DAYS),
      isRecommended: false,
      isActive: true,
      entitlements: defaultPlanEntitlements()
    })
    setOpen(true)
  }

  const openEdit = (p: SubscriptionPlan) => {
    const trialEnabled = p.trialEnabled !== false && (p.trialDays == null || p.trialDays > 0)

    setFormError(null)
    setForm({
      id: p._id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceMonthly: String(p.priceMonthly),
      priceYearly: p.priceYearly != null ? String(p.priceYearly) : '',
      currency: normalizeCurrency(p.currency),
      trialEnabled,
      trialDays: String(trialEnabled ? p.trialDays || TRIAL_DAYS : TRIAL_DAYS),
      isRecommended: Boolean(p.isDefault),
      isActive: p.isActive !== false,
      entitlements: normalizePlanEntitlements(p.entitlements || p, p.maxUsers)
    })
    setOpen(true)
  }

  const closeDialog = () => {
    if (saving) return
    setOpen(false)
    setFormError(null)
  }

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    setForm(prev => {
      if (field === 'name' && !isEdit) {
        const prevAuto = slugify(prev.name)
        const shouldSyncSlug = !prev.slug || prev.slug === prevAuto

        return {
          ...prev,
          name: value,
          ...(shouldSyncSlug ? { slug: slugify(value) } : {})
        }
      }

      return { ...prev, [field]: value }
    })
  }

  const buildSaveInput = () => ({
    name: form.name.trim(),
    slug: (form.slug.trim() || slugify(form.name)).toLowerCase(),
    description: form.description.trim(),
    priceMonthly: Number(form.priceMonthly || 0),
    priceYearly: form.priceYearly ? Number(form.priceYearly) : undefined,
    currency: form.currency || DEFAULT_CURRENCY,
    maxUsers: form.entitlements.limits.maxUsers,
    trialEnabled: form.trialEnabled,
    trialDays: form.trialEnabled ? Number(form.trialDays || TRIAL_DAYS) : 0,
    isDefault: form.isActive ? form.isRecommended : false,
    isActive: form.isActive,
    entitlements: form.entitlements,
    features: { ...form.entitlements.modules },
    ...(form.id ? { id: form.id } : {})
  })

  const persistPlan = async (input: NonNullable<typeof pendingSave>) => {
    if (input.id) {
      await subscriptionPlansService.update({ id: input.id, ...input })
    } else {
      await subscriptionPlansService.create(input)
    }

    setOpen(false)
    setImpactOpen(false)
    setPendingSave(null)
    setFormError(null)
    setError(null)
    await load()
  }

  const submit = async () => {
    const input = buildSaveInput()

    if (!input.name || !input.slug || !input.description) {
      setFormError('Name, slug, and description are required.')

      return
    }

    if (!Number.isFinite(input.priceMonthly) || input.priceMonthly < 0) {
      setFormError('Monthly price must be zero or greater.')

      return
    }

    setFormError(null)
    setError(null)

    try {
      if (isEdit && form.id) {
        setImpactLoading(true)
        setSaving(true)
        const preview = await subscriptionPlansService.previewImpact({ id: form.id, ...input })

        setPendingSave({ ...input, id: form.id })
        setImpactMessages(preview.messages || [])
        setOpen(false)
        setImpactOpen(true)
      } else {
        setSaving(true)
        await persistPlan(input)
      }
    } catch (e: any) {
      const message = e?.message || 'Failed to save plan'

      setFormError(message)
      setError(message)
      if (isEdit) setOpen(true)
    } finally {
      setImpactLoading(false)
      setSaving(false)
    }
  }

  const confirmImpactSave = async () => {
    if (!pendingSave || saving) return

    setSaving(true)

    try {
      await persistPlan(pendingSave)
    } catch (e: any) {
      const message = e?.message || 'Failed to save plan'

      setError(message)
      setFormError(message)
      setImpactOpen(false)
      setOpen(true)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!confirmId || deleting) return

    setDeleting(true)
    setDeleteError(null)

    try {
      await subscriptionPlansService.remove(confirmId)
      setConfirmId(null)
      setError(null)
      await load()
    } catch (e: any) {
      const message =
        e?.message && e.message !== 'request_failed' && e.message !== 'plan_has_subscribers'
          ? e.message
          : 'This plan is in use by one or more organisations. Migrate or remove those organisations first, or deactivate the plan instead of deleting it.'

      setDeleteError(message)
    } finally {
      setDeleting(false)
    }
  }

  const openDeleteConfirm = (id: string) => {
    setDeleteError(null)
    setConfirmId(id)
  }

  const togglePlanActive = async (p: SubscriptionPlan) => {
    const nextActive = p.isActive === false
    const label = nextActive ? 'reactivate' : 'deactivate'

    setTogglingId(p._id)
    setError(null)

    try {
      await subscriptionPlansService.update({
        id: p._id,
        isActive: nextActive,
        // Inactive plans cannot stay recommended for new orgs
        ...(nextActive ? {} : { isDefault: false })
      })
      await load()
    } catch (e: any) {
      setError(e?.message || `Failed to ${label} plan`)
    } finally {
      setTogglingId(null)
    }
  }

  const entitlementsSummary = (p: SubscriptionPlan) => {
    const e = normalizePlanEntitlements(p.entitlements || p, p.maxUsers)
    const modulesOn = Object.entries(e.modules)
      .filter(([, on]) => on)
      .map(([k]) => k)
    const fmt = (key: LimitFeatureKey) => {
      const n = e.limits[key]
      const value = n === UNLIMITED ? '∞' : String(n)

      return isMonthlyLimit(key) ? `${value}/mo` : value
    }

    return `Seats ${fmt('maxUsers')} · Customers ${fmt('maxCustomers')} · Leads ${fmt('maxLeads')}${
      modulesOn.length ? ` · ${modulesOn.length} modules` : ''
    }`
  }

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
      {error ? (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
          <Typography variant='h5'>All Plans</Typography>
          <Typography variant='body2' color='text.secondary'>
            Pricing, trial days, usage limits (seats total · customers & leads per month), and modules
          </Typography>
        </Box>
        <Button
          variant='contained'
          onClick={openCreate}
          startIcon={<i className='ri-add-line' />}
          fullWidth={isMobile}
          sx={{ minWidth: { sm: 180 } }}
        >
          Create New Plan
        </Button>
      </Box>

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading ? (
            <Typography variant='body2' color='text.secondary'>
              Loading...
            </Typography>
          ) : plans.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              No plans yet.
            </Typography>
          ) : (
            plans.map(p => (
              <Card
                key={p._id}
                sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'text.secondary' }}>
                      <i className='ri-price-tag-3-line text-lg' />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                            {p.name}
                          </Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {entitlementsSummary(p)}
                          </Typography>
                        </Box>
                        <IconButton size='small' onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                          <i className='ri-edit-2-line' />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
                        <Chip
                          size='small'
                          color={p.isActive !== false ? 'success' : 'default'}
                          label={p.isActive !== false ? 'Active' : 'Inactive'}
                        />
                        {p.isDefault ? (
                          <Chip
                            size='small'
                            color='primary'
                            label='Recommended'
                            icon={<i className='ri-star-smile-line' style={{ fontSize: 14 }} />}
                          />
                        ) : null}
                        <Chip size='small' variant='outlined' label={formatPlanMoney(p.priceMonthly, p.currency)} />
                        <Chip
                          size='small'
                          variant='outlined'
                          color={p.trialEnabled !== false && (p.trialDays ?? TRIAL_DAYS) > 0 ? 'success' : 'default'}
                          label={
                            p.trialEnabled !== false && (p.trialDays ?? TRIAL_DAYS) > 0
                              ? `Trial ${p.trialDays ?? TRIAL_DAYS}d`
                              : 'Trial off'
                          }
                        />
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.5 }}>
                        <Button size='small' variant='outlined' onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button
                          size='small'
                          variant='outlined'
                          color={p.isActive !== false ? 'warning' : 'success'}
                          disabled={togglingId === p._id}
                          onClick={() => void togglePlanActive(p)}
                        >
                          {togglingId === p._id
                            ? 'Updating…'
                            : p.isActive !== false
                              ? 'Deactivate'
                              : 'Activate'}
                        </Button>
                        <Button
                          size='small'
                          variant='outlined'
                          color='error'
                          onClick={() => openDeleteConfirm(p._id)}
                          sx={{ gridColumn: '1 / -1' }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Trial</TableCell>
              <TableCell>Recommended</TableCell>
              <TableCell>Entitlements</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map(p => (
              <TableRow key={p._id} sx={{ opacity: p.isActive === false ? 0.72 : 1 }}>
                <TableCell>{p.name}</TableCell>
                <TableCell>
                  <Chip
                    size='small'
                    color={p.isActive !== false ? 'success' : 'default'}
                    label={p.isActive !== false ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                <TableCell>{formatPlanMoney(p.priceMonthly, p.currency)}</TableCell>
                <TableCell>
                  {p.trialEnabled !== false && (p.trialDays ?? TRIAL_DAYS) > 0
                    ? `${p.trialDays ?? TRIAL_DAYS}d`
                    : 'Off'}
                </TableCell>
                <TableCell>
                  {p.isDefault ? (
                    <Chip size='small' color='primary' label='Yes' icon={<i className='ri-star-smile-line' />} />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{entitlementsSummary(p)}</TableCell>
                <TableCell align='right'>
                  <Button size='small' onClick={() => openEdit(p)} startIcon={<i className='ri-edit-2-line' />}>
                    Edit
                  </Button>
                  <Button
                    size='small'
                    color={p.isActive !== false ? 'warning' : 'success'}
                    disabled={togglingId === p._id}
                    onClick={() => void togglePlanActive(p)}
                    startIcon={<i className={p.isActive !== false ? 'ri-pause-circle-line' : 'ri-play-circle-line'} />}
                  >
                    {togglingId === p._id ? '…' : p.isActive !== false ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    color='error'
                    size='small'
                    onClick={() => openDeleteConfirm(p._id)}
                    startIcon={<i className='ri-delete-bin-6-line' />}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color='text.secondary'>No plans yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth='md' fullScreen={isMobile}>
        <DialogTitle>{isEdit ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          {formError ? (
            <Alert severity='error' sx={{ mt: 1 }}>
              {formError}
            </Alert>
          ) : null}
          <TextField label='Name' value={form.name} onChange={handleChange('name')} fullWidth autoFocus={!isEdit} />
          <TextField
            label='Slug'
            value={form.slug}
            onChange={handleChange('slug')}
            fullWidth
            helperText='URL-safe id. Auto-filled from the name; you can edit it.'
          />
          <TextField label='Description' value={form.description} onChange={handleChange('description')} fullWidth />
          <Box className='grid grid-cols-1 sm:grid-cols-4 gap-3'>
            <TextField
              label='Monthly Price'
              type='number'
              value={form.priceMonthly}
              onChange={handleChange('priceMonthly')}
              fullWidth
            />
            <TextField
              label='Yearly Price'
              type='number'
              value={form.priceYearly}
              onChange={handleChange('priceYearly')}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id='plan-currency-label'>Currency</InputLabel>
              <Select
                labelId='plan-currency-label'
                label='Currency'
                value={form.currency}
                onChange={e => setForm(prev => ({ ...prev, currency: String(e.target.value) }))}
              >
                {SUPPORTED_CURRENCIES.map(c => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code} — {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box className='flex flex-col gap-1 justify-center'>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.trialEnabled}
                    onChange={e => setForm(prev => ({ ...prev, trialEnabled: e.target.checked }))}
                  />
                }
                label='Trial period'
              />
              {form.trialEnabled ? (
                <TextField
                  label='Trial days'
                  type='number'
                  size='small'
                  value={form.trialDays}
                  onChange={handleChange('trialDays')}
                  helperText='Default 14'
                  fullWidth
                />
              ) : (
                <Typography variant='caption' color='text.secondary'>
                  New organisations skip the free trial
                </Typography>
              )}
            </Box>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={form.isActive}
                onChange={e => {
                  const next = e.target.checked

                  setForm(prev => ({
                    ...prev,
                    isActive: next,
                    ...(next ? {} : { isRecommended: false })
                  }))
                }}
              />
            }
            label={
              <Box>
                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                  Available for new organisations
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  When off, this plan is hidden from the create-organisation picker and cannot be selected for new
                  subscriptions. Existing organisations on the plan keep their access.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0, mt: 0.5 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.isRecommended}
                disabled={!form.isActive}
                onChange={e => setForm(prev => ({ ...prev, isRecommended: e.target.checked }))}
              />
            }
            label={
              <Box>
                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                  Mark as recommended
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  Highlighted on the create-organisation plan picker. Only one plan can be recommended.
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', ml: 0, mt: 0.5 }}
          />
          <Divider />
          <PlanEntitlementsEditor
            value={form.entitlements}
            onChange={entitlements => setForm(prev => ({ ...prev, entitlements }))}
          />
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeDialog} disabled={saving}>
            Cancel
          </Button>
          <Button variant='contained' onClick={submit} disabled={impactLoading || saving}>
            {saving ? 'Saving…' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={impactOpen}
        onClose={() => {
          if (saving) return
          setImpactOpen(false)
          setPendingSave(null)
          setOpen(true)
        }}
        fullScreen={isMobile}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Confirm plan changes</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity='warning'>
            Catalog edits affect organisations already on this plan. Review the timing below before saving.
          </Alert>
          <List dense disablePadding>
            {impactMessages.map(msg => (
              <ListItem key={msg} disableGutters sx={{ alignItems: 'flex-start' }}>
                <ListItemText primary={msg} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            variant='text'
            disabled={saving}
            onClick={() => {
              setImpactOpen(false)
              setPendingSave(null)
              setOpen(true)
            }}
          >
            Back
          </Button>
          <Button variant='contained' onClick={confirmImpactSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(confirmId)}
        onClose={() => {
          if (deleting) return
          setConfirmId(null)
          setDeleteError(null)
        }}
        fullScreen={isMobile}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Delete Plan</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {deleteError ? (
            <Alert severity='warning'>{deleteError}</Alert>
          ) : (
            <Typography>
              Are you sure you want to delete this plan? This cannot be undone. If organisations still use it, deactivate
              the plan instead so it is hidden from new subscribers.
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant='text'
            disabled={deleting}
            onClick={() => {
              setConfirmId(null)
              setDeleteError(null)
            }}
          >
            {deleteError ? 'Close' : 'Cancel'}
          </Button>
          {!deleteError ? (
            <Button color='error' variant='contained' onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
