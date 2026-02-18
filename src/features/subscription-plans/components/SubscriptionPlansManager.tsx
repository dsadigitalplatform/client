'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
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
    <Box className='flex flex-col gap-4'>
      {error && <Typography color='error'>{error}</Typography>}
      <Box className='flex items-center justify-between'>
        <Typography variant='h6'>All Plans</Typography>
        <Button variant='contained' size='small' onClick={openCreate} startIcon={<i className='ri-add-line' />}>
          Create New Plan
        </Button>
      </Box>
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

      <Dialog open={open} onClose={closeDialog} fullWidth maxWidth='sm'>
        <DialogTitle>{isEdit ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <TextField label='Name' value={form.name} onChange={handleChange('name')} />
          <TextField label='Slug' value={form.slug} onChange={handleChange('slug')} />
          <TextField label='Description' value={form.description} onChange={handleChange('description')} />
          <Box className='grid grid-cols-3 gap-3'>
            <TextField label='Monthly Price' type='number' value={form.priceMonthly} onChange={handleChange('priceMonthly')} />
            <TextField label='Yearly Price' type='number' value={form.priceYearly} onChange={handleChange('priceYearly')} />
            <TextField label='Currency' value={form.currency} onChange={handleChange('currency')} />
          </Box>
          <TextField label='Max Users' type='number' value={form.maxUsers} onChange={handleChange('maxUsers')} />
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeDialog}>Cancel</Button>
          <Button variant='contained' onClick={submit}>{isEdit ? 'Update' : 'Create'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={featuresOpen} onClose={closeFeatures} fullWidth maxWidth='sm'>
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
          <Box className='flex items-center gap-2'>
            <TextField
              label='New Feature Key'
              value={newFeature}
              onChange={e => setNewFeature(e.target.value)}
            />
            <Button variant='outlined' onClick={addFeature}>Add</Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeFeatures}>Cancel</Button>
          <Button variant='contained' onClick={saveFeatures}>Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(confirmId)} onClose={() => setConfirmId(null)}>
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
