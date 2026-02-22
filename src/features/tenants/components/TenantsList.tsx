'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

import { listTenantsByUser, updateTenant, type TenantItem } from '../services/tenantsOverviewService'
import primaryColorConfig from '@configs/primaryColorConfig'
import { useSettings } from '@core/hooks/useSettings'

export const TenantsList = () => {
  const [tenants, setTenants] = useState<TenantItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formName, setFormName] = useState<string>('')
  const [formType, setFormType] = useState<'sole_trader' | 'company'>('sole_trader')
  const [formPrimaryColor, setFormPrimaryColor] = useState<string>(primaryColorConfig[0].main)
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const { updateSettings } = useSettings()

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await listTenantsByUser()

      setTenants(res.tenants || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load tenants')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    ;

 (async () => {
      try {
        const sRes = await fetch('/api/session/tenant', { cache: 'no-store' })
        const s = await sRes.json().catch(() => ({}))
        const cid = typeof s?.currentTenantId === 'string' ? s.currentTenantId : null

        setCurrentTenantId(cid)
      } catch {
        // ignore
      }
    })()
  }, [])

  const openEdit = (t: TenantItem) => {
    setEditId(t._id)
    setFormName(t.name)
    setFormType(t.type)
    setFormPrimaryColor(primaryColorConfig[0].main)

      ; (async () => {
        try {
          const res = await fetch(`/api/tenants/${encodeURIComponent(t._id)}`, { cache: 'no-store' })
          const data = await res.json()

          if (res.ok) {
            const color = (data?.tenant?.themePrimaryColor as string | undefined) || undefined

            if (color) setFormPrimaryColor(color)
          }
        } catch {
          // ignore
        }
      })()
  }

  const closeEdit = () => {
    setEditId(null)
    setFormName('')
    setFormType('sole_trader')
  }

  const saveEdit = async () => {
    if (!editId) return

    try {
      await updateTenant(editId, { name: formName.trim(), type: formType })

      try {
        await fetch(`/api/tenants/${encodeURIComponent(editId)}/theme`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ primaryColor: formPrimaryColor })
        })

        if (currentTenantId && currentTenantId === editId) {
          updateSettings({ primaryColor: formPrimaryColor }, { updateCookie: false })
        }
      } catch { }

      closeEdit()
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to update tenant')
    }

  }

  return (
  <Box className='flex flex-col gap-4'>
        <Typography variant='h4'>Your Organisations</Typography>
        {error ? <Typography color='error'>{error}</Typography> : null}
        {loading && tenants.length === 0 && <Typography>Loading...</Typography>}
        {!loading && tenants.length === 0 && (
          <Typography color='text.secondary'>You have no active memberships.</Typography>
        )}
        <Box className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
          {tenants.map(t => {
            const canEdit = t.role === 'OWNER' || t.role === 'ADMIN'

            
return (
              <Card key={t._id}>
                <CardContent className='flex flex-col gap-2'>
                  <Typography variant='h6'>{t.name}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Type: {t.type} • Status: {t.status}
                  </Typography>
                  <Box className='flex items-center gap-2'>
                    {canEdit ? (
                      <Button variant='outlined' onClick={() => openEdit(t)}>
                        Edit
                      </Button>
                    ) : (
                      <Button variant='outlined' disabled>
                        Read-only
                      </Button>
                    )}
                  </Box>
              </CardContent>
            </Card>
          )
        })}
      </Box>

      <Dialog open={Boolean(editId)} onClose={closeEdit} fullWidth maxWidth='sm'>
        <DialogTitle>Edit Organisation</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <TextField label='Name' value={formName} onChange={e => setFormName(e.target.value)} />
          <Select value={formType} onChange={e => setFormType(e.target.value as any)}>
            <MenuItem value='sole_trader'>Sole Trader</MenuItem>
            <MenuItem value='company'>Company</MenuItem>
          </Select>
          <Box>
            <Typography variant='subtitle2' color='text.secondary'>
              Primary Color
            </Typography>
            <Box className='flex items-center gap-2 mt-2'>
              {primaryColorConfig.map(c => (
                <Button
                  key={c.main}
                  variant={formPrimaryColor === c.main ? 'outlined' : 'text'}
                  onClick={() => setFormPrimaryColor(c.main)}
                  sx={{
                    minWidth: 0,
                    p: 0.5,
                    borderRadius: '10px',
                    borderColor: formPrimaryColor === c.main ? c.main : undefined
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '8px',
                      backgroundColor: c.main,
                      boxShadow: formPrimaryColor === c.main ? `0 0 0 2px ${c.main}` : 'none'
                    }}
                  />
                </Button>
              ))}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeEdit}>Cancel</Button>
          <Button variant='contained' onClick={saveEdit}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
