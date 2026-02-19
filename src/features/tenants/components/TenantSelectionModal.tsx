'use client'

import { useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import { listTenantsByUser, type TenantItem } from '../services/tenantsOverviewService'

type Props = {
  open?: boolean
}

export const TenantSelectionModal = ({ open = false }: Props) => {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState<boolean>(open)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<TenantItem[]>([])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    setError(null)
    listTenantsByUser()
      .then(res => setItems(res.tenants || []))
      .catch(e => setError(e?.message || 'Failed to load organisations'))
      .finally(() => setLoading(false))
  }, [isOpen])

  const choose = async (id: string) => {
    try {
      const res = await fetch('/api/session/tenant?return=json', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ tenantId: id }).toString()
      })

      const data = await res.json()

      if (!res.ok || !data?.success) throw new Error('Failed to select organisation')
      setIsOpen(false)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Failed to select organisation')
    }
  }

  return (
    <Dialog open={isOpen} fullWidth maxWidth='sm' disableEscapeKeyDown>
      <DialogTitle>Select Organisation</DialogTitle>
      <DialogContent className='flex flex-col gap-3'>
        <Typography color='text.secondary'>Choose an organisation to continue.</Typography>
        {error ? <Typography color='error'>{error}</Typography> : null}
        {loading ? <Typography>Loading...</Typography> : null}
        {!loading && items.length > 0 && (
          <Box className='flex flex-col gap-2'>
            {items.map(t => (
              <Button key={t._id} variant='contained' onClick={() => choose(t._id)}>
                {t.name}
              </Button>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  )
}
