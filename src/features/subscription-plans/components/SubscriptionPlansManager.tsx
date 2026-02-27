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
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import type { SubscriptionPlan } from '../subscription-plans.types'
import { subscriptionPlansService } from '../services/subscriptionPlansService'

type FormState = {
  id?: string
  name: string
  slug: string
  description: string
  priceMonthly: string
  priceYearly?: string
  currency: string
  maxUsers: string
}

export const SubscriptionPlansManager = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const [featuresPlanId, setFeaturesPlanId] = useState<string | null>(null)
  const [featuresMap, setFeaturesMap] = useState<Record<string, boolean>>({})
  const [newFeature, setNewFeature] = useState('')

  const [form, setForm] = useState<FormState>({
    name: '',
    slug: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    currency: 'USD',
    maxUsers: ''
  })

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const formatMoney = (currency: string, amount: number | null | undefined) => {
    if (amount == null) return '-'

    const locale = currency === 'INR' ? 'en-IN' : undefined

    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount)
    } catch {
      return `${currency} ${amount}`
    }
  }

  const isEdit = useMemo(() => Boolean(form.id), [form.id])

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
    // initial load
    load()
  }, [])

  const openCreate = () => {
    setForm({
      name: '',
      slug: '',
      description: '',
      priceMonthly: '',
      priceYearly: '',
      currency: 'USD',
      maxUsers: ''
    })
    setOpen(true)
  }

  const openEdit = (p: SubscriptionPlan) => {
    setForm({
      id: p._id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceMonthly: String(p.priceMonthly),
      priceYearly: p.priceYearly != null ? String(p.priceYearly) : '',
      currency: p.currency,
      maxUsers: String(p.maxUsers)
    })
    setOpen(true)
  }

  const closeDialog = () => setOpen(false)

  const closeFeatures = () => {
    setFeaturesOpen(false)
    setFeaturesPlanId(null)
    setFeaturesMap({})
    setNewFeature('')
  }

  const openFeatures = async (p: SubscriptionPlan) => {
    try {
      setError(null)
      const res = await subscriptionPlansService.getFeatures(p._id)

      setFeaturesMap(res.features || {})
      setFeaturesPlanId(p._id)
      setFeaturesOpen(true)
    } catch (e: any) {
      setError(e?.message || 'Failed to load features')
    }
  }

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  const submit = async () => {
    const input = {
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim(),
      priceMonthly: Number(form.priceMonthly || 0),
      priceYearly: form.priceYearly ? Number(form.priceYearly) : undefined,
      currency: form.currency || 'USD',
      maxUsers: Number(form.maxUsers || 1)
    }

    if (!input.name || !input.slug || !input.description || input.priceMonthly < 0 || input.maxUsers < 1) return

    try {
      if (isEdit && form.id) {
        await subscriptionPlansService.update({ id: form.id, ...input })
      } else {
        await subscriptionPlansService.create(input)
      }

      setOpen(false)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to save plan')
    }
  }

  const toggleFeature = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked

    setFeaturesMap(prev => ({ ...prev, [key]: checked }))
  }

  const addFeature = () => {
    const k = newFeature.trim()

    if (!k || featuresMap.hasOwnProperty(k)) return
    setFeaturesMap(prev => ({ ...prev, [k]: true }))
    setNewFeature('')
  }

  const saveFeatures = async () => {
    if (!featuresPlanId) return

    try {
      await subscriptionPlansService.updateFeatures(featuresPlanId, featuresMap)
      closeFeatures()
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to save features')
    }
  }

  const confirmDelete = async () => {
    if (!confirmId) return

    try {
      await subscriptionPlansService.remove(confirmId)
      setConfirmId(null)
      await load()
    } catch (e: any) {
      setConfirmId(null)
      setError(e?.message || 'Failed to delete plan')
    }
  }

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
      {error && <Typography color='error'>{error}</Typography>}
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
            Manage subscription plans and features
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
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  Loading...
                </Typography>
              </CardContent>
            </Card>
          ) : plans.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No plans yet.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            plans.map(p => (
              <Card
                key={p._id}
                sx={{
                  borderRadius: 3,
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper'
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: 'action.hover', color: 'text.secondary' }}>
                      <i className='ri-price-tag-3-line text-lg' />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant='subtitle1' sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                              {p.name}
                            </Typography>
                            {p.isDefault ? (
                              <Chip
                                size='small'
                                label='Default'
                                variant='outlined'
                                sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)' }}
                              />
                            ) : null}
                            {!p.isActive ? <Chip size='small' label='Inactive' variant='outlined' /> : null}
                          </Box>
                        </Box>
                        <IconButton size='small' onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                          <i className='ri-edit-2-line' />
                        </IconButton>
                      </Box>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={{
                          mt: 0.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {p.description}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
                        <Chip
                          size='small'
                          variant='outlined'
                          label={`Monthly: ${formatMoney(p.currency, p.priceMonthly)}`}
                          sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)' }}
                        />
                        <Chip
                          size='small'
                          variant='outlined'
                          label={`Yearly: ${p.priceYearly != null ? formatMoney(p.currency, p.priceYearly) : '-'}`}
                          sx={{ boxShadow: 'none' }}
                        />
                        <Chip size='small' variant='outlined' label={`Max users: ${p.maxUsers}`} sx={{ boxShadow: 'none' }} />
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mt: 1.5 }}>
                        <Button
                          size='small'
                          variant='outlined'
                          onClick={() => openFeatures(p)}
                          startIcon={<i className='ri-toggle-line' />}
                        >
                          Features
                        </Button>
                        <Button
                          size='small'
                          variant='outlined'
                          color='error'
                          onClick={() => setConfirmId(p._id)}
                          startIcon={<i className='ri-delete-bin-6-line' />}
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
              <TableCell>Monthly</TableCell>
              <TableCell>Yearly</TableCell>
              <TableCell>Currency</TableCell>
              <TableCell>Max Users</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {plans.map(p => (
              <TableRow key={p._id}>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.priceMonthly}</TableCell>
                <TableCell>{p.priceYearly ?? '-'}</TableCell>
                <TableCell>{p.currency}</TableCell>
                <TableCell>{p.maxUsers}</TableCell>
                <TableCell align='right'>
                  <Button size='small' onClick={() => openEdit(p)} startIcon={<i className='ri-edit-2-line' />}>
                    Edit
                  </Button>
                  <Button size='small' onClick={() => openFeatures(p)} startIcon={<i className='ri-toggle-line' />}>
                    Features
                  </Button>
                  <Button
                    color='error'
                    size='small'
                    onClick={() => setConfirmId(p._id)}
                    startIcon={<i className='ri-delete-bin-6-line' />}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!loading && plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography color='text.secondary'>No plans yet.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth='sm' fullScreen={isMobile}>
        <DialogTitle>{isEdit ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <TextField label='Name' value={form.name} onChange={handleChange('name')} fullWidth />
          <TextField label='Slug' value={form.slug} onChange={handleChange('slug')} fullWidth />
          <TextField label='Description' value={form.description} onChange={handleChange('description')} fullWidth />
          <Box className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
            <TextField label='Monthly Price' type='number' value={form.priceMonthly} onChange={handleChange('priceMonthly')} fullWidth />
            <TextField label='Yearly Price' type='number' value={form.priceYearly} onChange={handleChange('priceYearly')} fullWidth />
            <TextField label='Currency' value={form.currency} onChange={handleChange('currency')} fullWidth />
          </Box>
          <TextField label='Max Users' type='number' value={form.maxUsers} onChange={handleChange('maxUsers')} fullWidth />
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeDialog}>Cancel</Button>
          <Button variant='contained' onClick={submit}>{isEdit ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={featuresOpen} onClose={closeFeatures} fullWidth maxWidth='sm' fullScreen={isMobile}>
        <DialogTitle>Configure Features</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <Box className='flex flex-col gap-2'>
            {Object.keys(featuresMap).length === 0 && <Typography color='text.secondary'>No features yet.</Typography>}
            {Object.keys(featuresMap).sort().map(k => (
              <FormControlLabel
                key={k}
                control={<Checkbox checked={Boolean(featuresMap[k])} onChange={toggleFeature(k)} />}
                label={k}
              />
            ))}
          </Box>
          <Box className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <TextField
              label='New Feature Key'
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
              fullWidth
            />
            <Button variant='outlined' onClick={addFeature}>Add</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeFeatures}>Cancel</Button>
          <Button variant='contained' onClick={saveFeatures}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)} fullScreen={isMobile}>
        <DialogTitle>Delete Plan</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this plan?</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={() => setConfirmId(null)}>Cancel</Button>
          <Button color='error' variant='contained' onClick={confirmDelete}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
