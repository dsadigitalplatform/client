'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Checkbox from '@mui/material/Checkbox'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import { useTheme } from '@mui/material/styles'

import { dbMaintenanceService } from '../services/dbMaintenanceService'
import type {
  DbMaintenanceCollectionInfo,
  DbMaintenanceDocumentPreview,
  DbMaintenanceTenantInfo,
  DbMaintenanceTenantPurgeResult
} from '../db-maintenance.types'

export const DbMaintenanceView = () => {
  const [collections, setCollections] = useState<DbMaintenanceCollectionInfo[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const [lastResult, setLastResult] = useState<{
    name: string
    before: number
    deleted: number
    after: number
  } | null>(null)

  const [tenants, setTenants] = useState<DbMaintenanceTenantInfo[]>([])
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [tenantsLoading, setTenantsLoading] = useState(false)
  const [tenantError, setTenantError] = useState<string | null>(null)
  const [purgeOpen, setPurgeOpen] = useState(false)
  const [purgeConfirmText, setPurgeConfirmText] = useState('')
  const [purging, setPurging] = useState(false)
  const [lastPurgeResult, setLastPurgeResult] = useState<DbMaintenanceTenantPurgeResult | null>(null)

  const [recordsOpen, setRecordsOpen] = useState(false)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const [recordsError, setRecordsError] = useState<string | null>(null)
  const [records, setRecords] = useState<DbMaintenanceDocumentPreview[]>([])
  const [recordsNextCursor, setRecordsNextCursor] = useState<string | null>(null)
  const [recordSelections, setRecordSelections] = useState<Record<string, boolean>>({})
  const [recordsConfirmOpen, setRecordsConfirmOpen] = useState(false)
  const [recordsConfirmText, setRecordsConfirmText] = useState('')
  const [deletingSelected, setDeletingSelected] = useState(false)

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const selectedInfo = useMemo(() => collections.find(c => c.name === selected) || null, [collections, selected])
  const selectedIds = useMemo(() => Object.keys(recordSelections).filter(k => recordSelections[k]), [recordSelections])
  const selectedTenant = useMemo(() => tenants.find(t => t.id === selectedTenantId) || null, [tenants, selectedTenantId])

  const load = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await dbMaintenanceService.list()
      const list = Array.isArray(res?.collections) ? res.collections : []

      setCollections(list)
      if (selected && !list.some(c => c.name === selected)) setSelected('')
    } catch (e: any) {
      setError(e?.message || 'Failed to load collections')
    } finally {
      setLoading(false)
    }
  }

  const loadTenants = async () => {
    setTenantsLoading(true)
    setTenantError(null)

    try {
      const res = await dbMaintenanceService.listTenants()
      const list = Array.isArray(res?.tenants) ? res.tenants : []

      setTenants(list)
      if (selectedTenantId && !list.some(t => t.id === selectedTenantId)) setSelectedTenantId('')
    } catch (e: any) {
      setTenantError(e?.message || 'Failed to load tenants')
    } finally {
      setTenantsLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadTenants()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openPurge = () => {
    setPurgeConfirmText('')
    setPurgeOpen(true)
  }

  const closePurge = () => {
    if (purging) return
    setPurgeOpen(false)
    setPurgeConfirmText('')
  }

  const canConfirmPurge = Boolean(selectedTenant) && purgeConfirmText.trim() === (selectedTenant?.name || '')

  const purgeTenant = async () => {
    if (!selectedTenantId || !canConfirmPurge) return

    setPurging(true)
    setTenantError(null)
    setLastPurgeResult(null)

    try {
      const res = await dbMaintenanceService.purgeTenant(selectedTenantId)

      setLastPurgeResult(res.result || null)
      setPurgeOpen(false)
      setPurgeConfirmText('')
      await loadTenants()
      await load()
    } catch (e: any) {
      setTenantError(e?.message || 'Failed to purge tenant')
    } finally {
      setPurging(false)
    }
  }

  const openConfirm = () => {
    setConfirmText('')
    setConfirmOpen(true)
  }

  const closeConfirm = () => {
    if (clearing) return
    setConfirmOpen(false)
    setConfirmText('')
  }

  const canConfirm = Boolean(selected) && confirmText.trim() === selected

  const clearSelected = async () => {
    if (!selected || !canConfirm) return

    setClearing(true)
    setError(null)
    setLastResult(null)

    try {
      const res = await dbMaintenanceService.clear(selected)

      setLastResult(res.result || null)
      setConfirmOpen(false)
      setConfirmText('')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to clear collection')
    } finally {
      setClearing(false)
    }
  }

  const loadRecords = async (collectionName: string, opts?: { reset?: boolean }) => {
    if (!collectionName) return

    const reset = Boolean(opts?.reset)

    setRecordsLoading(true)
    setRecordsError(null)

    try {
      const cursor = reset ? null : recordsNextCursor
      const res = await dbMaintenanceService.listDocuments(collectionName, { limit: 50, cursor })
      const items = Array.isArray(res?.items) ? res.items : []

      if (reset) {
        setRecords(items)
      } else {
        setRecords(prev => [...prev, ...items])
      }

      setRecordsNextCursor(res?.nextCursor ?? null)
    } catch (e: any) {
      setRecordsError(e?.message || 'Failed to load records')
    } finally {
      setRecordsLoading(false)
    }
  }

  const openRecords = async (collectionName?: string) => {
    const name = typeof collectionName === 'string' && collectionName.length > 0 ? collectionName : selected

    if (!name) return

    setSelected(name)
    setRecordsOpen(true)
    setRecordSelections({})
    setRecords([])
    setRecordsNextCursor(null)
    await loadRecords(name, { reset: true })
  }

  const closeRecords = () => {
    if (recordsLoading || deletingSelected) return

    setRecordsOpen(false)
    setRecordsError(null)
    setRecordSelections({})
    setRecords([])
    setRecordsNextCursor(null)
    setRecordsConfirmOpen(false)
    setRecordsConfirmText('')
  }

  const toggleRecord = (id: string) => {
    setRecordSelections(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const openDeleteSelectedConfirm = () => {
    setRecordsConfirmText('')
    setRecordsConfirmOpen(true)
  }

  const closeDeleteSelectedConfirm = () => {
    if (deletingSelected) return
    setRecordsConfirmOpen(false)
    setRecordsConfirmText('')
  }

  const canDeleteSelected = recordsConfirmText.trim().toUpperCase() === 'DELETE' && selectedIds.length > 0

  const deleteSelected = async () => {
    if (!selected || !canDeleteSelected) return

    setDeletingSelected(true)
    setError(null)
    setRecordsError(null)

    try {
      await dbMaintenanceService.deleteDocuments(selected, selectedIds)
      setRecordSelections({})
      setRecordsConfirmOpen(false)
      setRecordsConfirmText('')
      await loadRecords(selected, { reset: true })
      await load()
    } catch (e: any) {
      setRecordsError(e?.message || 'Failed to delete records')
    } finally {
      setDeletingSelected(false)
    }
  }

  return (
    <Box className='flex flex-col gap-4'>
      <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2 }}>
          <Typography variant='h6'>Tools</Typography>
          <Typography variant='body2' color='text.secondary'>
            Database maintenance tools for super admins.
          </Typography>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant='h6'>Tenant Maintenance</Typography>
            <Typography variant='body2' color='text.secondary'>
              Purge all records for a tenant. Users are removed only if they are not super admins and not part of other tenants.
            </Typography>
          </Box>

          {tenantError && <Typography color='error'>{tenantError}</Typography>}

          <FormControl fullWidth size='small'>
            <InputLabel id='db-maintenance-tenant-select-label'>Tenant</InputLabel>
            <Select
              labelId='db-maintenance-tenant-select-label'
              value={selectedTenantId}
              label='Tenant'
              onChange={e => setSelectedTenantId(String(e.target.value))}
              disabled={tenantsLoading || purging}
            >
              {tenants.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Button variant='outlined' onClick={loadTenants} disabled={tenantsLoading || purging} fullWidth={isMobile}>
              Refresh Tenants
            </Button>
            <Button
              color='error'
              variant='contained'
              onClick={openPurge}
              disabled={!selectedTenantId || tenantsLoading || purging}
              fullWidth={isMobile}
            >
              Purge Tenant Data
            </Button>
          </Box>

          {lastPurgeResult && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant='body2' sx={{ fontWeight: 600 }}>
                Purge result: {lastPurgeResult.tenantName || lastPurgeResult.tenantId}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Deleted users: {lastPurgeResult.deletedUsers} | Kept super admins: {lastPurgeResult.keptUsers.superAdmins} | Kept users in other tenants:{' '}
                {lastPurgeResult.keptUsers.otherTenants}
              </Typography>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Collection</TableCell>
                    <TableCell align='right'>Deleted</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(lastPurgeResult.deletedByCollection).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell>{k}</TableCell>
                      <TableCell align='right'>{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
        <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
              <Typography variant='h6'>Collections</Typography>
              <Typography variant='body2' color='text.secondary'>
                Select a collection and clear all documents.
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button variant='outlined' onClick={load} disabled={loading || clearing} fullWidth={isMobile}>
                Refresh
              </Button>
              <Button
                variant='outlined'
                onClick={() => openRecords()}
                disabled={!selected || loading || clearing}
                fullWidth={isMobile}
              >
                View Records
              </Button>
              <Button
                color='error'
                variant='contained'
                onClick={openConfirm}
                disabled={!selected || loading || clearing}
                fullWidth={isMobile}
              >
                Clear Selected
              </Button>
            </Box>
          </Box>

          {error && <Typography color='error'>{error}</Typography>}
          {lastResult && (
            <Typography variant='body2' color='text.secondary'>
              Cleared {lastResult.name}: {lastResult.before} → {lastResult.after} (deleted {lastResult.deleted})
            </Typography>
          )}

          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {loading ? (
                <Typography variant='body2' color='text.secondary'>
                  Loading...
                </Typography>
              ) : collections.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No collections found.
                </Typography>
              ) : (
                collections.map(c => (
                  <Card
                    key={c.name}
                    sx={{
                      borderRadius: 3,
                      boxShadow: 'none',
                      border: '1px solid',
                      borderColor: selected === c.name ? 'primary.main' : 'divider'
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Button
                            variant='text'
                            onClick={() => openRecords(c.name)}
                            sx={{ px: 0, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left' }}
                          >
                            <Typography variant='subtitle1' sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
                              {c.name}
                            </Typography>
                          </Button>
                          <Typography variant='body2' color='text.secondary'>
                            {c.exists ? `Docs: ${c.documentCount}` : 'Not created yet'}
                          </Typography>
                        </Box>
                        <Button
                          size='small'
                          variant={selected === c.name ? 'contained' : 'outlined'}
                          onClick={() => setSelected(c.name)}
                        >
                          {selected === c.name ? 'Selected' : 'Select'}
                        </Button>
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
                  <TableCell>Selected</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell align='right'>Docs</TableCell>
                  <TableCell align='right'>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4}>Loading...</TableCell>
                  </TableRow>
                ) : collections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No collections found.</TableCell>
                  </TableRow>
                ) : (
                  collections.map(c => (
                    <TableRow
                      key={c.name}
                      hover
                      selected={selected === c.name}
                      sx={{ cursor: 'default' }}
                    >
                      <TableCell>
                        <Button
                          size='small'
                          variant={selected === c.name ? 'contained' : 'outlined'}
                          onClick={() => setSelected(c.name)}
                        >
                          {selected === c.name ? 'Selected' : 'Select'}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button variant='text' onClick={() => openRecords(c.name)} sx={{ px: 0, minWidth: 0 }}>
                          {c.name}
                        </Button>
                      </TableCell>
                      <TableCell align='right'>{c.exists ? c.documentCount : '-'}</TableCell>
                      <TableCell align='right'>{c.exists ? 'Ready' : 'Missing'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {selectedInfo && (
            <Typography variant='body2' color='text.secondary'>
              Selected: {selectedInfo.name}
              {selectedInfo.exists ? ` (Docs: ${selectedInfo.documentCount})` : ' (Not created yet)'}
            </Typography>
          )}
        </CardContent>
      </Card>


      <Dialog open={confirmOpen} onClose={closeConfirm} fullWidth maxWidth='sm' fullScreen={isMobile}>
        <DialogTitle>Clear Collection</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <Typography variant='body2' color='text.secondary'>
            This will permanently delete all documents in: <strong>{selected || '-'}</strong>
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Type the collection name to confirm.
          </Typography>
          <TextField
            label='Confirm collection name'
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeConfirm} disabled={clearing}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={clearSelected} disabled={!canConfirm || clearing}>
            {clearing ? 'Clearing...' : 'Clear'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={purgeOpen} onClose={closePurge} fullWidth maxWidth='sm' fullScreen={isMobile}>
        <DialogTitle>Purge Tenant Data</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <Typography variant='body2' color='text.secondary'>
            This will permanently delete all records for tenant: <strong>{selectedTenant?.name || '-'}</strong>
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Users will be deleted only if they are not super admins and not part of any other tenant.
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Type the tenant name exactly to confirm.
          </Typography>
          <TextField
            label='Tenant name'
            value={purgeConfirmText}
            onChange={e => setPurgeConfirmText(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closePurge} disabled={purging}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={purgeTenant} disabled={!canConfirmPurge || purging}>
            {purging ? 'Purging...' : 'Purge'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={recordsOpen} onClose={closeRecords} fullWidth maxWidth='md' fullScreen={isMobile}>
        <DialogTitle>Records: {selected || '-'}</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          {recordsError && <Typography color='error'>{recordsError}</Typography>}
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Typography variant='body2' color='text.secondary'>
              Selected records: {selectedIds.length}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
              <Button variant='outlined' onClick={() => loadRecords(selected, { reset: true })} disabled={recordsLoading || deletingSelected} fullWidth={isMobile}>
                Refresh
              </Button>
              <Button
                color='error'
                variant='contained'
                onClick={openDeleteSelectedConfirm}
                disabled={selectedIds.length === 0 || recordsLoading || deletingSelected}
                fullWidth={isMobile}
              >
                Delete Selected
              </Button>
            </Box>
          </Box>

          {isMobile ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {records.map(r => (
                <Card key={r.id} sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Checkbox checked={Boolean(recordSelections[r.id])} onChange={() => toggleRecord(r.id)} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant='subtitle2' sx={{ wordBreak: 'break-word' }}>
                          {r.id}
                        </Typography>
                        <Typography variant='body2' color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                          {r.summary || '-'}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          ) : (
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox' />
                  <TableCell>ID</TableCell>
                  <TableCell>Summary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recordsLoading && records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>Loading...</TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3}>No records found.</TableCell>
                  </TableRow>
                ) : (
                  records.map(r => (
                    <TableRow key={r.id} hover onClick={() => toggleRecord(r.id)} sx={{ cursor: 'pointer' }}>
                      <TableCell padding='checkbox'>
                        <Checkbox checked={Boolean(recordSelections[r.id])} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280, wordBreak: 'break-word' }}>{r.id}</TableCell>
                      <TableCell sx={{ wordBreak: 'break-word' }}>{r.summary || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Typography variant='body2' color='text.secondary'>
              Showing {records.length}
            </Typography>
            <Button
              variant='outlined'
              onClick={() => loadRecords(selected, { reset: false })}
              disabled={!recordsNextCursor || recordsLoading || deletingSelected}
              fullWidth={isMobile}
            >
              Load More
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeRecords} disabled={recordsLoading || deletingSelected}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={recordsConfirmOpen} onClose={closeDeleteSelectedConfirm} fullWidth maxWidth='sm' fullScreen={isMobile}>
        <DialogTitle>Delete Selected Records</DialogTitle>
        <DialogContent className='flex flex-col gap-3'>
          <Typography variant='body2' color='text.secondary'>
            This will permanently delete {selectedIds.length} selected record(s) from: <strong>{selected || '-'}</strong>
          </Typography>
          <Typography variant='body2' color='text.secondary'>Type DELETE to confirm.</Typography>
          <TextField
            label='Type DELETE to confirm'
            value={recordsConfirmText}
            onChange={e => setRecordsConfirmText(e.target.value)}
            fullWidth
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={closeDeleteSelectedConfirm} disabled={deletingSelected}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={deleteSelected} disabled={!canDeleteSelected || deletingSelected}>
            {deletingSelected ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
