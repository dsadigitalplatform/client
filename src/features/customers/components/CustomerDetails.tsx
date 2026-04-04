'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableContainer from '@mui/material/TableContainer'
import MuiLink from '@mui/material/Link'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import CustomersCreateForm from './CustomersCreateForm'
import { getCustomer, updateCustomer, deleteCustomer } from '@features/customers/services/customersService'
import { getLoanCases } from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'

type Props = { id: string }

const CustomerDetails = ({ id }: Props) => {
  const router = useRouter()
  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [leads, setLeads] = useState<LoanCaseListItem[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success'
  })

  const [confirmOpen, setConfirmOpen] = useState(false)

  const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

  const stageChipColor = (name: string) => {
    const n = name.toLowerCase()

    if (n.includes('approved')) return 'success' as const
    if (n.includes('rejected')) return 'error' as const
    if (n.includes('pending')) return 'warning' as const
    if (n.includes('login')) return 'info' as const

    return 'default' as const
  }

  const contactTypeLabel = (value: string) => {
    const map: Record<string, string> = {
      ALTERNATE: 'Alternate',
      SPOUSE: 'Spouse',
      FRIEND: 'Friend',
      RELATIVE: 'Relative',
      OTHER: 'Other'
    }

    return map[String(value).toUpperCase()] || 'Other'
  }

  const fetchData = async () => {
    setLoading(true)
    const d = await getCustomer(id)

    setData({
      ...d,
      secondaryContacts: Array.isArray(d?.secondaryContacts) ? d.secondaryContacts : []
    })
    setLoading(false)
  }

  const fetchLeads = async () => {
    setLeadsLoading(true)
    setLeadsError(null)

    try {
      const rows = await getLoanCases({ customerId: id })

      setLeads(rows)
    } catch {
      setLeads([])
      setLeadsError('Failed to load leads')
    } finally {
      setLeadsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    fetchLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!editMode) return
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode])

  if (loading) return <Typography>Loading...</Typography>
  if (!data) return <Typography>Not found</Typography>

  const secondaryContacts = Array.isArray(data.secondaryContacts) ? data.secondaryContacts : []
  const canManage = Boolean(data?.canManage)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card
        sx={{
          borderRadius: { xs: 4, sm: 3 },
          boxShadow: isMobile ? 'none' : 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))',
          border: isMobile ? '1px solid' : 'none',
          borderColor: isMobile ? 'divider' : 'transparent'
        }}
      >
        {!editMode ? (
          <>
            {!isMobile ? (
              <CardHeader
                title='Customer Details'
                subheader={
                  <Box className='flex items-center gap-2'>
                    <Typography component='span' fontWeight={600}>
                      {data.fullName}
                    </Typography>
                    {data.isNRI ? (
                      <Chip
                        size='small'
                        label='NRI'
                        variant='outlined'
                        icon={<i className='ri-global-line' />}
                        sx={{
                          boxShadow: 'none',
                          borderColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.5)',
                          color: 'warning.main',
                          backgroundColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)'
                        }}
                      />
                    ) : null}
                    <Chip
                      size='small'
                      label={data.employmentType === 'SALARIED' ? 'Salaried' : 'Self-employed'}
                      variant='outlined'
                      sx={{
                        boxShadow: 'none',
                        backgroundColor:
                          data.employmentType === 'SALARIED'
                            ? 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                            : 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)'
                      }}
                    />
                  </Box>
                }
              />
            ) : null}
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              {isMobile ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Button
                    variant='text'
                    onClick={() => router.push('/customers')}
                    startIcon={<i className='ri-arrow-left-line' />}
                    sx={{ minWidth: 'auto', px: 1 }}
                  >
                    Back
                  </Button>
                  <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                    Customer
                  </Typography>
                  {canManage ? (
                    <IconButton color='primary' onClick={() => setEditMode(true)} aria-label='Edit customer'>
                      <i className='ri-pencil-line' />
                    </IconButton>
                  ) : (
                    <Box sx={{ width: 40, height: 40 }} />
                  )}
                </Box>
              ) : null}
              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: 'action.hover', color: 'text.secondary', mb: 1 }}>
                    {String(data.fullName || '')
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((s: string) => s[0]?.toUpperCase())
                      .join('')}
                  </Avatar>
                  <Typography variant='h6' sx={{ fontWeight: 600 }}>
                    {data.fullName}
                  </Typography>
                  {data.isNRI ? (
                    <Chip
                      size='small'
                      label='NRI'
                      variant='outlined'
                      icon={<i className='ri-global-line' />}
                      sx={{
                        mt: 0.75,
                        boxShadow: 'none',
                        borderColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.5)',
                        color: 'warning.main',
                        backgroundColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)'
                      }}
                    />
                  ) : null}
                  <Chip
                    size='small'
                    label={data.employmentType === 'SALARIED' ? 'Salaried' : 'Self-employed'}
                    variant='outlined'
                    sx={{
                      mt: 0.75,
                      boxShadow: 'none',
                      backgroundColor:
                        data.employmentType === 'SALARIED'
                          ? 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)'
                          : 'rgb(var(--mui-palette-secondary-mainChannel) / 0.08)'
                    }}
                  />
                </Box>
              ) : null}
              {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-smartphone-line text-base' />
                    <Typography color='text.secondary'>{[data.countryCode, data.mobile].filter(Boolean).join(' ')}</Typography>
                  </Box>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-mail-line text-base' />
                    <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                      {data.email || '-'}
                    </Typography>
                  </Box>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-bank-card-line text-base' />
                    <Typography color='text.secondary'>{data.pan || '-'}</Typography>
                  </Box>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-shield-keyhole-line text-base' />
                    <Typography color='text.secondary'>{data.aadhaarMasked || '-'}</Typography>
                  </Box>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-map-pin-line text-base' />
                    <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                      {data.address || '-'}
                    </Typography>
                  </Box>
                  <Box className='flex items-center gap-1.5'>
                    <i className='ri-sticky-note-line text-base' />
                    <Typography color='text.secondary' sx={{ wordBreak: 'break-word' }}>
                      {data.remarks || '-'}
                    </Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography color='text.secondary'>Income</Typography>
                    <Typography color='text.primary'>
                      {data.monthlyIncome != null ? formatINR(data.monthlyIncome) : '-'}
                    </Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography color='text.secondary'>CIBIL</Typography>
                    <Typography color='text.primary'>{data.cibilScore != null ? data.cibilScore : '-'}</Typography>
                  </Box>
                  <Box className='flex items-center justify-between'>
                    <Typography color='text.secondary'>Source</Typography>
                    <Typography color='text.primary'>{String(data.source).replace('_', ' ')}</Typography>
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>
                      Secondary Contacts
                    </Typography>
                    {secondaryContacts.length === 0 ? (
                      <Typography color='text.secondary'>No secondary contacts</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                        {secondaryContacts.map((contact: any, index: number) => (
                          <Box
                            key={`secondary-contact-mobile-${index}`}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 2,
                              p: 1.5,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.75
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip size='small' label={contactTypeLabel(contact.type)} variant='outlined' />
                              <Typography color='text.secondary'>
                                {[contact.countryCode, contact.mobile].filter(Boolean).join(' ')}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box className='flex flex-col gap-1'>
                  <Typography color='text.secondary'>
                    Mobile: {[data.countryCode, data.mobile].filter(Boolean).join(' ')}
                  </Typography>
                  <Typography color='text.secondary'>Email: {data.email || '-'}</Typography>
                  <Typography color='text.secondary'>PAN: {data.pan || '-'}</Typography>
                  <Typography color='text.secondary'>Aadhaar: {data.aadhaarMasked || '-'}</Typography>
                  <Typography color='text.secondary'>Address: {data.address || '-'}</Typography>
                  <Typography color='text.secondary'>Remarks: {data.remarks || '-'}</Typography>
                  <Typography color='text.secondary'>
                    Income: {data.monthlyIncome != null ? formatINR(data.monthlyIncome) : '-'}
                  </Typography>
                  <Typography color='text.secondary'>CIBIL: {data.cibilScore != null ? data.cibilScore : '-'}</Typography>
                  <Typography color='text.secondary'>Source: {String(data.source).replace('_', ' ')}</Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1 }}>
                      Secondary Contacts
                    </Typography>
                    <TableContainer
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        overflowX: 'auto'
                      }}
                    >
                      <Table size='small' sx={{ minWidth: 420 }}>
                        <TableHead>
                          <TableRow>
                            <TableCell>Type</TableCell>
                            <TableCell>Contact</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {secondaryContacts.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2}>
                                <Typography color='text.secondary'>No secondary contacts</Typography>
                              </TableCell>
                            </TableRow>
                          ) : (
                            secondaryContacts.map((contact: any, index: number) => (
                              <TableRow key={`secondary-contact-${index}`}>
                                <TableCell>{contactTypeLabel(contact.type)}</TableCell>
                                <TableCell>{[contact.countryCode, contact.mobile].filter(Boolean).join(' ')}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Box>
              )}
              <Divider sx={{ my: { xs: 2.5, sm: 3 } }} />
              {isMobile ? (
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  {canManage ? (
                    <>
                      <Button variant='contained' fullWidth onClick={() => setEditMode(true)}>
                        Update
                      </Button>
                      <Button variant='outlined' color='error' fullWidth onClick={() => setConfirmOpen(true)}>
                        Delete
                      </Button>
                    </>
                  ) : (
                    <Button fullWidth onClick={() => router.push('/customers')}>
                      Back to List
                    </Button>
                  )}
                </Box>
              ) : (
                <Box className='flex gap-2'>
                  {canManage ? (
                    <>
                      <Button variant='contained' onClick={() => setEditMode(true)}>
                        Update
                      </Button>
                      <Button variant='outlined' color='error' onClick={() => setConfirmOpen(true)}>
                        Delete
                      </Button>
                    </>
                  ) : null}
                  <Link href='/customers'>
                    <Button>Back to List</Button>
                  </Link>
                </Box>
              )}
            </CardContent>
          </>
        ) : (
          <>
            {!isMobile ? <CardHeader title='Update Customer' /> : null}
            <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
              <CustomersCreateForm
                showTitle={false}
                variant='plain'
                submitLabel='Update Customer'
                redirectOnSuccess
                initialValues={{
                  fullName: data.fullName,
                  countryCode: data.countryCode,
                  mobile: data.mobile,
                  isNRI: data.isNRI,
                  secondaryContacts: data.secondaryContacts,
                  email: data.email,
                  dob: data.dob,
                  pan: data.pan,
                  aadhaarMasked: data.aadhaarMasked,
                  address: data.address,
                  remarks: data.remarks,
                  employmentType: data.employmentType,
                  source: data.source,
                  monthlyIncome: data.monthlyIncome,
                  cibilScore: data.cibilScore
                }}
                onSubmitOverride={async payload => {
                  await updateCustomer(id, payload)
                }}
                onSuccess={() => {
                  fetchData()
                  setEditMode(false)
                }}
                onCancel={() => setEditMode(false)}
              />
            </CardContent>
          </>
        )}
      </Card>

      {!editMode ? (
        <Accordion
          defaultExpanded={!isMobile}
          sx={{
            borderRadius: { xs: 4, sm: 3 },
            boxShadow: isMobile ? 'none' : 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))',
            border: isMobile ? '1px solid' : 'none',
            borderColor: isMobile ? 'divider' : 'transparent',
            '&.Mui-expanded': { margin: 0 }
          }}
        >
          <AccordionSummary
            sx={{
              px: { xs: 2.5, sm: 3 },
              py: { xs: 2, sm: 2.5 },
              '& .MuiAccordionSummary-content': { alignItems: 'center' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Linked Leads</Typography>
                <Chip
                  size='small'
                  label={leadsLoading ? 'Loading…' : `${leads.length}`}
                  variant='outlined'
                  sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-text-primaryChannel) / 0.04)' }}
                />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.25 }}>

                {isMobile ? (
                  <IconButton
                    color='primary'
                    aria-label='Create lead'
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(`/loan-cases/create?customerId=${encodeURIComponent(id)}`)
                    }}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      boxShadow: 'var(--mui-customShadows-sm, 0px 4px 14px rgba(0,0,0,0.10))'
                    }}
                  >
                    <i className='ri-lightbulb-flash-line' />
                  </IconButton>
                ) : (
                  <Button
                    variant='contained'
                    size='small'
                    startIcon={<i className='ri-lightbulb-flash-line' />}
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      router.push(`/loan-cases/create?customerId=${encodeURIComponent(id)}`)
                    }}
                    sx={{ borderRadius: 99, boxShadow: 'none', textTransform: 'none' }}
                  >
                    Create Lead
                  </Button>
                )}
              </Box>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
            {leadsError ? (
              <Typography variant='body2' color='error'>
                {leadsError}
              </Typography>
            ) : leadsLoading ? (
              <Typography variant='body2' color='text.secondary'>
                Loading leads...
              </Typography>
            ) : leads.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No leads linked to this customer
              </Typography>
            ) : isMobile ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {leads.map(c => (
                  <Card
                    key={c.id}
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
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <MuiLink
                            component={Link}
                            href={`/loan-cases/${c.id}`}
                            underline='hover'
                            color='text.primary'
                            sx={{
                              fontSize: '1rem',
                              fontWeight: 700,
                              display: 'block',
                              textOverflow: 'ellipsis',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              transition: 'color .2s ease',
                              '&:hover': { color: 'primary.main' }
                            }}
                          >
                            {c.loanTypeName || 'Lead'}
                          </MuiLink>
                          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
                            {c.bankName ? `${c.bankName} • ` : ''}
                            {typeof c.requestedAmount === 'number' ? formatINR(c.requestedAmount) : '—'}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                            <Chip
                              size='small'
                              label={c.stageName || 'Stage'}
                              color={stageChipColor(c.stageName || '')}
                              variant='outlined'
                              sx={{ boxShadow: 'none' }}
                            />
                            <Chip
                              size='small'
                              label={c.assignedAgentName || c.assignedAgentEmail || 'Unassigned'}
                              variant='outlined'
                              sx={{ boxShadow: 'none', backgroundColor: 'rgb(var(--mui-palette-text-primaryChannel) / 0.04)' }}
                            />
                          </Box>
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                            Updated: {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size='small' sx={{ minWidth: 840 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Lead</TableCell>
                      <TableCell>Bank</TableCell>
                      <TableCell align='right'>Requested</TableCell>
                      <TableCell>Stage</TableCell>
                      <TableCell>Assigned Agent</TableCell>
                      <TableCell>Last Updated</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {leads.map(c => (
                      <TableRow key={c.id} hover>
                        <TableCell>
                          <MuiLink component={Link} href={`/loan-cases/${c.id}`} underline='hover' sx={{ fontWeight: 700 }}>
                            {c.loanTypeName || 'Lead'}
                          </MuiLink>
                        </TableCell>
                        <TableCell>{c.bankName || '—'}</TableCell>
                        <TableCell align='right'>
                          {typeof c.requestedAmount === 'number' ? formatINR(c.requestedAmount) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size='small'
                            label={c.stageName || 'Stage'}
                            color={stageChipColor(c.stageName || '')}
                            variant='outlined'
                            sx={{ boxShadow: 'none' }}
                          />
                        </TableCell>
                        <TableCell>{c.assignedAgentName || c.assignedAgentEmail || '—'}</TableCell>
                        <TableCell>{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      ) : null}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete Customer</DialogTitle>
        <DialogContent>Are you sure you want to delete this customer?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            color='error'
            onClick={async () => {
              try {
                await deleteCustomer(id)
                setToast({ open: true, msg: 'Customer deleted', severity: 'success' })
                setConfirmOpen(false)
                router.push('/customers')
              } catch {
                setToast({ open: true, msg: 'Failed to delete', severity: 'error' })
              }
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(v => ({ ...v, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast(v => ({ ...v, open: false }))}
          severity={toast.severity}
          variant='filled'
          icon={<i className='ri-information-line' />}
          sx={{
            width: '100%',
            color: 'text.primary',
            backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor:
              toast.severity === 'success'
                ? 'rgb(var(--mui-palette-success-mainChannel) / 0.4)'
                : 'rgb(var(--mui-palette-error-mainChannel) / 0.4)',
            boxShadow: '0 12px 30px rgb(0 0 0 / 0.12)',
            '& .MuiAlert-icon': {
              color: toast.severity === 'success' ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-error-main)'
            }
          }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default CustomerDetails
