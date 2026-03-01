'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import { mutate } from 'swr'

import { useSession } from 'next-auth/react'

import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemAvatar from '@mui/material/ListItemAvatar'
import ListItemText from '@mui/material/ListItemText'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'

import { listTenantsByUser, type TenantItem } from '../services/tenantsOverviewService'
import { useSettings } from '@core/hooks/useSettings'

type Props = {
  open: boolean
  onClose: () => void
}

export const SwitchOrganisationDialog = ({ open, onClose }: Props) => {
  const router = useRouter()
  const { update } = useSession()
  const { updateSettings } = useSettings()
  const [loading, setLoading] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TenantItem[]>([])
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [redirectOpen, setRedirectOpen] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null)
  const [redirectProgress, setRedirectProgress] = useState(0)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    Promise.all([
      listTenantsByUser(),
      fetch('/api/session/tenant', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))
    ])
      .then(([res, sessionTenant]) => {
        setItems(res.tenants || [])
        const c = typeof sessionTenant?.currentTenantId === 'string' ? sessionTenant.currentTenantId : null

        setCurrentTenantId(c)
      })
      .catch(e => setError(e?.message || 'Failed to load organisations'))
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!redirectOpen || !redirectTarget) return

    setRedirectProgress(0)
    const totalMs = 2200
    const tickMs = 50
    const step = (100 * tickMs) / totalMs
    let current = 0

    const t = window.setInterval(() => {
      current = Math.min(100, current + step)
      setRedirectProgress(current)

      if (current >= 100) {
        window.clearInterval(t)
        setRedirectOpen(false)
        setSwitching(false)
        onClose()
        router.replace(redirectTarget)

        try {
          router.refresh()
        } catch {}
      }
    }, tickMs)

    return () => window.clearInterval(t)
  }, [onClose, redirectOpen, redirectTarget, router])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()

    if (!q) return items

    return items.filter(t => t.name.toLowerCase().includes(q))
  }, [items, query])

  const choose = async (id: string) => {
    try {
      setSwitching(true)
      setError(null)
      setSuccessMsg('')
      setRedirectProgress(0)
      setRedirectTarget(null)
      setRedirectOpen(true)

      const res = await fetch('/api/session/tenant?return=json', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tenantId: id }).toString()
      })

      const data = await res.json()

      if (!res.ok || !data?.success) throw new Error('Failed to switch organisation')

      try {
        await mutate('/api/session/tenant')
      } catch {}

      try {
        const tRes = await fetch(`/api/tenants/${encodeURIComponent(id)}`, { cache: 'no-store' })
        const tData = await tRes.json().catch(() => ({}))
        const primary: string | undefined = tData?.tenant?.themePrimaryColor

        if (primary) {
          updateSettings({ primaryColor: primary }, { updateCookie: false })
        }
      } catch {}

      try {
        await update({ currentTenantId: id } as any)
      } catch {}

      setCurrentTenantId(id)
      setSuccessMsg('Organisation switched successfully')
      setRedirectTarget('/home')
    } catch (e: any) {
      setError(e?.message || 'Failed to switch organisation')
      setSwitching(false)
      setRedirectOpen(false)
    }
  }

  return (
    <Dialog open={open} onClose={switching ? () => undefined : onClose} fullWidth maxWidth='sm'>
      <DialogTitle>Switch Organisation</DialogTitle>
      <DialogContent className='flex flex-col gap-3'>
        <Typography color='text.secondary'>Select an organisation to switch context.</Typography>
        {error ? <Typography color='error'>{error}</Typography> : null}
        <TextField
          size='small'
          placeholder='Search organisations'
          value={query}
          onChange={e => setQuery(e.target.value)}
          disabled={switching}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-search-line opacity-70' />
              </InputAdornment>
            )
          }}
        />
        {loading ? <Typography>Loading...</Typography> : null}
        {!loading && filtered.length > 0 && (
          <Box className='flex flex-col'>
            <List disablePadding>
              {filtered.map((t, idx) => {
                const isCurrent = currentTenantId === t._id


                return (
                  <Box key={t._id}>
                    <ListItemButton
                      onClick={() => choose(t._id)}
                      disabled={isCurrent || switching}
                      className='rounded-lg'
                    >
                      <ListItemAvatar>
                        <Avatar>
                          <i className='ri-building-4-line' />
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        disableTypography
                        primary={
                          <Tooltip title={t.name}>
                            <span>{t.name}</span>
                          </Tooltip>
                        }
                        secondary={
                          <Box className='flex items-center gap-2'>
                            <Chip size='small' label={t.role || 'USER'} />
                            {isCurrent ? <Chip size='small' color='success' variant='outlined' label='Current' /> : null}
                          </Box>
                        }
                      />
                    </ListItemButton>
                    {idx < filtered.length - 1 ? <Divider component='div' className='opacity-50' /> : null}
                  </Box>
                )
              })}
            </List>
          </Box>
        )}
        {!loading && filtered.length === 0 ? <Typography color='text.secondary'>No organisations found</Typography> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={switching}>Close</Button>
      </DialogActions>

      <Dialog open={redirectOpen} onClose={() => undefined} disableEscapeKeyDown>
        <DialogContent sx={{ p: 3, width: { xs: 'calc(100vw - 32px)', sm: 420 } }}>
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)', color: 'success.main' }}>
                <i className='ri-checkbox-circle-line' />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                  {successMsg || 'Switching organisation...'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Taking you to Home...
                </Typography>
              </Box>
            </Box>

            {redirectTarget ? <LinearProgress variant='determinate' value={redirectProgress} /> : <LinearProgress />}

            {redirectTarget ? (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant='caption' color='text.secondary'>
                  Please wait
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {Math.round(redirectProgress)}%
                </Typography>
              </Box>
            ) : null}
          </Stack>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
