'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'

import { listTenantsByUser, type TenantItem } from '../services/tenantsOverviewService'

type Props = {
  open: boolean
  onClose: () => void
}

export const SwitchOrganisationDialog = ({ open, onClose }: Props) => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TenantItem[]>([])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    listTenantsByUser()
      .then(res => setItems(res.tenants || []))
      .catch(e => setError(e?.message || 'Failed to load organisations'))
      .finally(() => setLoading(false))
  }, [open])

  const choose = async (id: string) => {
    try {
      const res = await fetch('/api/session/tenant?return=json', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tenantId: id }).toString()
      })

      const data = await res.json()

      if (!res.ok || !data?.success) throw new Error('Failed to switch organisation')
      onClose()
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to switch organisation')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
      <DialogTitle>Switch Organisation</DialogTitle>
      <DialogContent className='flex flex-col gap-3'>
        <Typography color='text.secondary'>Select an organisation to switch context.</Typography>
        {error ? <Typography color='error'>{error}</Typography> : null}
        {loading ? <Typography>Loading...</Typography> : null}
        {!loading && items.length > 0 && (
          <Box className='flex flex-col gap-2'>
            {items.map(t => (
              <Stack key={t._id} direction='row' spacing={2} alignItems='center'>
                <Button variant='outlined' onClick={() => choose(t._id)}>
                  {t.name}
                </Button>
                <Chip size='small' label={t.role} />
              </Stack>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
