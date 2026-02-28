'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import Select from '@mui/material/Select'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import LinearProgress from '@mui/material/LinearProgress'
import { useTheme } from '@mui/material/styles'

import CustomersCreateForm from '@features/customers/components/CustomersCreateForm'
import { useCustomers } from '@features/customers/hooks/useCustomers'
import { createCustomer } from '@features/customers/services/customersService'
import type { Customer } from '@features/customers/customers.types'
import { getLoanTypes } from '@features/loan-types/services/loanTypesService'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import type { LoanType } from '@features/loan-types/loan-types.types'
import {
  createLoanCase,
  getChecklistByLoanType,
  getLoanCaseById,
  getTenantUsers,
  updateLoanCase
} from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseDetails, LoanCaseDocument, LoanCaseDocumentStatus, TenantUserOption } from '@features/loan-cases/loan-cases.types'

type StageOption = { id: string; name: string; order: number }

type Props = {
  caseId?: string
}

const DOCUMENT_STATUS_OPTIONS: Array<{ value: LoanCaseDocumentStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COLLECTED', label: 'Collected' },
  { value: 'SUBMITTED_TO_BANK', label: 'Submitted to Bank' },
  { value: 'APPROVED', label: 'Approved' }
]

const LoanCaseForm = ({ caseId }: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [loanTypes, setLoanTypes] = useState<LoanType[]>([])
  const [stages, setStages] = useState<StageOption[]>([])
  const [users, setUsers] = useState<TenantUserOption[]>([])

  const [loading, setLoading] = useState(Boolean(caseId))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [successOpen, setSuccessOpen] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [redirectOpen, setRedirectOpen] = useState(false)
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null)
  const [redirectProgress, setRedirectProgress] = useState(0)

  const [id, setId] = useState<string | null>(caseId ?? null)
  const [isLocked, setIsLocked] = useState(false)

  const { customers, loading: customersLoading, setSearch, refresh: refreshCustomers } = useCustomers()

  const [customerValue, setCustomerValue] = useState<Customer | null>(null)
  const [customerInputValue, setCustomerInputValue] = useState<string>('')
  const [customerId, setCustomerId] = useState<string>('')
  const [loanTypeId, setLoanTypeId] = useState<string>('')
  const [stageId, setStageId] = useState<string>('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')

  const [bankName, setBankName] = useState<string>('')
  const [requestedAmount, setRequestedAmount] = useState<string>('')
  const [eligibleAmount, setEligibleAmount] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('')
  const [tenureMonths, setTenureMonths] = useState<string>('')
  const [emi, setEmi] = useState<string>('')

  const [documents, setDocuments] = useState<LoanCaseDocument[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)

  const [openAddCustomer, setOpenAddCustomer] = useState(false)

  const selectedLoanType = useMemo(() => loanTypes.find(l => l.id === loanTypeId) ?? null, [loanTypes, loanTypeId])
  const stageOptions = useMemo(() => stages.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [stages])
  const userOptions = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users])

  useEffect(() => {
    const msg = sessionStorage.getItem('loanCaseSaveSuccess')

    if (!msg) return

    sessionStorage.removeItem('loanCaseSaveSuccess')
    setSuccessMsg(msg)
    setSuccessOpen(true)
  }, [])

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
        router.push(redirectTarget)
      }
    }, tickMs)

    return () => window.clearInterval(t)
  }, [redirectOpen, redirectTarget, router])

  useEffect(() => {
    if (!customerId) return

    const found = customers.find(c => c.id === customerId)

    if (!found) return

    if (customerValue?.id !== customerId) setCustomerValue(found)

    if (customerInputValue.trim().length === 0) {
      setCustomerInputValue(`${found.fullName}${found.mobile ? ` (${found.mobile})` : ''}`)
    }
  }, [customerId, customerInputValue, customerValue?.id, customers])

  const parseNumber = (v: string) => {
    const n = Number(v)

    if (!Number.isFinite(n)) return null

    return n
  }

  useEffect(() => {

    void (async () => {
      try {
        const [loanTypesData, stagesData, usersData] = await Promise.all([
          getLoanTypes(),
          getLoanStatusPipelineStages(),
          getTenantUsers()
        ])

        setLoanTypes(loanTypesData as any)
        setStages(stagesData as any)
        setUsers(usersData as any)
      } catch (e: any) {
        setError(e?.message || 'Failed to load reference data')
      }
    })()
  }, [])

  useEffect(() => {
    if (!caseId) return

    void (async () => {
      setLoading(true)

      try {
        const data = (await getLoanCaseById(caseId)) as LoanCaseDetails

        setId(data.id)
        setCustomerId(data.customerId)
        setCustomerValue({
          id: data.customerId,
          fullName: data.customerName || '',
          mobile: '',
          email: null,
          employmentType: 'SALARIED',
          monthlyIncome: null,
          cibilScore: null,
          source: 'OTHER',
          createdAt: null
        })
        setCustomerInputValue(data.customerName || '')
        setLoanTypeId(data.loanTypeId)
        setStageId(data.stageId)
        setAssignedAgentId(data.assignedAgentId || '')
        setBankName(data.bankName || '')
        setRequestedAmount(data.requestedAmount != null ? String(data.requestedAmount) : '')
        setEligibleAmount(data.eligibleAmount != null ? String(data.eligibleAmount) : '')
        setInterestRate(data.interestRate != null ? String(data.interestRate) : '')
        setTenureMonths(data.tenureMonths != null ? String(data.tenureMonths) : '')
        setEmi(data.emi != null ? String(data.emi) : '')
        setDocuments(Array.isArray(data.documents) ? data.documents : [])
        setIsLocked(Boolean(data.isLocked))
      } catch (e: any) {
        setError(e?.message || 'Failed to load loan case')
      } finally {
        setLoading(false)
      }
    })()
  }, [caseId])

  useEffect(() => {
    if (!loanTypeId) return
    if (id) return

    void (async () => {
      setChecklistLoading(true)

      try {
        const checklist = await getChecklistByLoanType(loanTypeId)

        setDocuments(checklist)
      } catch {
        setDocuments([])
      } finally {
        setChecklistLoading(false)
      }
    })()
  }, [loanTypeId, id])

  const validate = () => {
    const next: Record<string, string> = {}
    const requested = parseNumber(requestedAmount)
    const eligible = eligibleAmount.trim().length === 0 ? null : parseNumber(eligibleAmount)
    const rate = interestRate.trim().length === 0 ? null : parseNumber(interestRate)
    const tenure = tenureMonths.trim().length === 0 ? null : parseNumber(tenureMonths)
    const emiN = emi.trim().length === 0 ? null : parseNumber(emi)

    if (!customerId) next.customerId = 'Customer is required'
    if (!loanTypeId) next.loanTypeId = 'Loan type is required'
    if (!stageId) next.stageId = 'Stage is required'
    if (!(typeof requested === 'number' && requested > 0)) next.requestedAmount = 'Loan amount must be greater than 0'
    if (emiN != null && typeof emiN !== 'number') next.emi = 'EMI must be numeric'
    if (rate != null && typeof rate !== 'number') next.interestRate = 'Interest rate must be numeric'
    if (tenure != null && typeof tenure !== 'number') next.tenureMonths = 'Tenure must be numeric'
    if (eligible != null && typeof eligible !== 'number') next.eligibleAmount = 'Eligible amount must be numeric'

    if (assignedAgentId) {
      const isValid = users.some(u => u.id === assignedAgentId)

      if (!isValid) next.assignedAgentId = 'Assigned agent must belong to tenant'
    }

    setFieldErrors(next)

    return { ok: Object.keys(next).length === 0, parsed: { requested, eligible, rate, tenure, emiN } }
  }

  const handleSave = async () => {
    setError(null)
    const { ok, parsed } = validate()

    if (!ok) return
    setSubmitting(true)

    try {
      const payloadBase = {
        customerId,
        loanTypeId,
        stageId,
        assignedAgentId: assignedAgentId || null,
        bankName: bankName.trim().length === 0 ? null : bankName.trim(),
        requestedAmount: parsed.requested as number,
        eligibleAmount: parsed.eligible,
        interestRate: parsed.rate,
        tenureMonths: parsed.tenure,
        emi: parsed.emiN
      }

      if (!id) {
        const res = await createLoanCase(payloadBase)

        setId(res.id)
        setIsLocked(true)

        setSuccessMsg('Lead created successfully')
        setRedirectTarget('/loan-cases')
        setRedirectOpen(true)
      } else {
        await updateLoanCase(id, {
          ...payloadBase,
          documents: documents.map(d => ({ documentId: d.documentId, status: d.status }))
        })

        setSuccessMsg('Lead updated successfully')
        setRedirectTarget('/loan-cases')
        setRedirectOpen(true)
      }
    } catch (e: any) {
      if (e?.details) setFieldErrors(e.details)
      setError(e?.message || 'Failed to save loan case')
    } finally {
      setSubmitting(false)
    }
  }

  const headerTitle = id ? 'Lead manager' : 'Create Lead'
  const headerSub = id ? 'Update lead' : 'Create & link a new lead '

  const statusChip = (s: LoanCaseDocumentStatus) => {
    switch (s) {
      case 'APPROVED':
        return { label: 'Approved', color: 'success' as const }
      case 'SUBMITTED_TO_BANK':
        return { label: 'Submitted', color: 'info' as const }
      case 'COLLECTED':
        return { label: 'Collected', color: 'warning' as const }
      default:
        return { label: 'Pending', color: 'default' as const }
    }
  }

  const saveLabel = submitting ? 'Saving...' : 'Save'

  return (
    <Box sx={{ pb: isMobile ? 10 : 0 }}>
      <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
        <CardHeader
          title={headerTitle}
          subheader={headerSub}
          action={
            isMobile ? (
              <IconButton onClick={() => router.push('/loan-cases')} aria-label='Back to lead manager'>
                <i className='ri-close-line' />
              </IconButton>
            ) : null
          }
        />
        <CardContent sx={{ p: { xs: 2.5, sm: 3 }, '& .MuiFormHelperText-root': { mt: 0.75 } }}>
          {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}

          {loading ? (
            <Typography variant='body2' color='text.secondary'>
              Loading...
            </Typography>
          ) : (
            <Stack spacing={isMobile ? 3.5 : 3.5}>


              <Divider />

              <Grid container rowSpacing={{ xs: 3, sm: 3 }} columnSpacing={{ xs: 2, sm: 3 }}>
                <Grid size={{ xs: 12, sm: 8 }}>
                  <Autocomplete
                    options={customers}
                    value={customerValue}
                    loading={customersLoading}
                    getOptionLabel={o => `${o.fullName}${o.mobile ? ` (${o.mobile})` : ''}`}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, v) => {
                      setCustomerValue(v)
                      setCustomerId(v?.id || '')
                      setCustomerInputValue(v ? `${v.fullName}${v.mobile ? ` (${v.mobile})` : ''}` : '')
                      if (!v) setSearch('')
                    }}
                    inputValue={customerInputValue}
                    onInputChange={(_, v, reason) => {
                      setCustomerInputValue(v)
                      if (reason === 'input') setSearch(v)
                      if (reason === 'clear') setSearch('')
                    }}
                    disabled={isLocked}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label='Customer'
                        error={!!fieldErrors.customerId}
                        helperText={fieldErrors.customerId}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position='start'>
                              <i className='ri-user-line' />
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Button
                    variant='outlined'
                    startIcon={<i className='ri-user-add-line' />}
                    onClick={() => setOpenAddCustomer(true)}
                    fullWidth
                    sx={{ height: '100%' }}
                    disabled={isLocked}
                  >
                    Add Customer
                  </Button>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size='small' error={!!fieldErrors.loanTypeId}>
                    <InputLabel id='loan-case-loan-type'>Loan Type</InputLabel>
                    <Select
                      labelId='loan-case-loan-type'
                      label='Loan Type'
                      value={loanTypeId}
                      onChange={e => setLoanTypeId(String(e.target.value))}
                      disabled={isLocked}
                      renderValue={v => loanTypes.find(x => x.id === v)?.name || 'Select'}
                    >
                      {loanTypes
                        .filter(l => l.isActive)
                        .map(l => (
                          <MenuItem key={l.id} value={l.id}>
                            {l.name}
                          </MenuItem>
                        ))}
                    </Select>
                    {fieldErrors.loanTypeId ? (
                      <Typography variant='caption' color='error' sx={{ display: 'block', mt: 0.75 }}>
                        {fieldErrors.loanTypeId}
                      </Typography>
                    ) : null}
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label='Bank / NBFC'
                    value={bankName}
                    onChange={e => setBankName(e.target.value)}
                    fullWidth
                    size='small'
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position='start'>
                          <i className='ri-bank-line' />
                        </InputAdornment>
                      )
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label='Loan Amount Requested'
                    value={requestedAmount}
                    onChange={e => setRequestedAmount(e.target.value.replace(/[^\d.]/g, ''))}
                    fullWidth
                    size='small'
                    error={!!fieldErrors.requestedAmount}
                    helperText={fieldErrors.requestedAmount}
                    InputProps={{
                      startAdornment: <InputAdornment position='start'>₹</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label='Eligible Amount'
                    value={eligibleAmount}
                    onChange={e => setEligibleAmount(e.target.value.replace(/[^\d.]/g, ''))}
                    fullWidth
                    size='small'
                    error={!!fieldErrors.eligibleAmount}
                    helperText={fieldErrors.eligibleAmount}
                    InputProps={{
                      startAdornment: <InputAdornment position='start'>₹</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label='Interest Rate'
                    value={interestRate}
                    onChange={e => setInterestRate(e.target.value.replace(/[^\d.]/g, ''))}
                    fullWidth
                    size='small'
                    error={!!fieldErrors.interestRate}
                    helperText={fieldErrors.interestRate}
                    InputProps={{
                      endAdornment: <InputAdornment position='end'>%</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label='Tenure'
                    value={tenureMonths}
                    onChange={e => setTenureMonths(e.target.value.replace(/[^\d]/g, ''))}
                    fullWidth
                    size='small'
                    error={!!fieldErrors.tenureMonths}
                    helperText={fieldErrors.tenureMonths}
                    InputProps={{
                      endAdornment: <InputAdornment position='end'>months</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label='EMI'
                    value={emi}
                    onChange={e => setEmi(e.target.value.replace(/[^\d.]/g, ''))}
                    fullWidth
                    size='small'
                    error={!!fieldErrors.emi}
                    helperText={fieldErrors.emi}
                    InputProps={{
                      startAdornment: <InputAdornment position='start'>₹</InputAdornment>
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size='small' error={!!fieldErrors.assignedAgentId}>
                    <InputLabel id='loan-case-agent'>Assigned Agent</InputLabel>
                    <Select
                      labelId='loan-case-agent'
                      label='Assigned Agent'
                      value={assignedAgentId}
                      onChange={e => setAssignedAgentId(String(e.target.value))}
                    >
                      <MenuItem value=''>Unassigned</MenuItem>
                      {userOptions.map(u => (
                        <MenuItem key={u.id} value={u.id}>
                          {u.name || u.email || u.id}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldErrors.assignedAgentId ? (
                      <Typography variant='caption' color='error' sx={{ display: 'block', mt: 0.75 }}>
                        {fieldErrors.assignedAgentId}
                      </Typography>
                    ) : null}
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size='small' error={!!fieldErrors.stageId}>
                    <InputLabel id='loan-case-stage'>Stage</InputLabel>
                    <Select
                      labelId='loan-case-stage'
                      label='Stage'
                      value={stageId}
                      onChange={e => setStageId(String(e.target.value))}
                    >
                      {stageOptions.map(s => (
                        <MenuItem key={s.id} value={s.id}>
                          {s.name}
                        </MenuItem>
                      ))}
                    </Select>
                    {fieldErrors.stageId ? (
                      <Typography variant='caption' color='error' sx={{ display: 'block', mt: 0.75 }}>
                        {fieldErrors.stageId}
                      </Typography>
                    ) : null}
                  </FormControl>
                </Grid>
              </Grid>

              <Divider />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
                <Box>
                  <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                    Document Checklist
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {selectedLoanType ? `Auto-mapped from “${selectedLoanType.name}”` : 'Select loan type to load checklist'}
                  </Typography>
                </Box>
                {checklistLoading ? (
                  <Chip size='small' label='Loading...' variant='outlined' />
                ) : documents.length > 0 ? (
                  <Chip size='small' label={`${documents.length} docs`} variant='outlined' />
                ) : null}
              </Box>

              {!loanTypeId ? (
                <Paper
                  variant='outlined'
                  sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', borderStyle: 'dashed' }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    Pick a loan type to generate the checklist.
                  </Typography>
                </Paper>
              ) : checklistLoading ? (
                <Paper
                  variant='outlined'
                  sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', borderStyle: 'dashed' }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    Generating checklist...
                  </Typography>
                </Paper>
              ) : documents.length === 0 ? (
                <Paper
                  variant='outlined'
                  sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', borderStyle: 'dashed' }}
                >
                  <Typography variant='body2' color='text.secondary'>
                    No checklist mapping found for this loan type.
                  </Typography>
                </Paper>
              ) : isMobile ? (
                <Box>
                  {documents.map(d => {
                    const meta = statusChip(d.status)

                    return (
                      <Accordion key={d.documentId} disableGutters sx={{ borderRadius: 2.5, overflow: 'hidden', mb: 1.5 }}>
                        <AccordionSummary expandIcon={<i className='ri-arrow-down-s-line' />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                            <Typography sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>{d.documentName}</Typography>
                            <Chip size='small' label={meta.label} color={meta.color} variant='outlined' sx={{ height: 24 }} />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <FormControl fullWidth size='small'>
                            <InputLabel id={`doc-status-${d.documentId}`}>Status</InputLabel>
                            <Select
                              labelId={`doc-status-${d.documentId}`}
                              label='Status'
                              value={d.status}
                              onChange={e => {
                                const next = String(e.target.value) as LoanCaseDocumentStatus

                                setDocuments(prev =>
                                  prev.map(x => (x.documentId === d.documentId ? { ...x, status: next } : x))
                                )
                              }}
                            >
                              {DOCUMENT_STATUS_OPTIONS.map(o => (
                                <MenuItem key={o.value} value={o.value}>
                                  {o.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </AccordionDetails>
                      </Accordion>
                    )
                  })}
                </Box>
              ) : (
                <Paper variant='outlined' sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Document Name</TableCell>
                        <TableCell width={260}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {documents.map(d => (
                        <TableRow key={d.documentId} hover>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600 }}>{d.documentName}</Typography>
                          </TableCell>
                          <TableCell>
                            <FormControl fullWidth size='small'>
                              <Select
                                value={d.status}
                                onChange={e => {
                                  const next = String(e.target.value) as LoanCaseDocumentStatus

                                  setDocuments(prev => prev.map(x => (x.documentId === d.documentId ? { ...x, status: next } : x)))
                                }}
                              >
                                {DOCUMENT_STATUS_OPTIONS.map(o => (
                                  <MenuItem key={o.value} value={o.value}>
                                    {o.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Paper>
              )}
            </Stack>
          )}
        </CardContent>

        {!isMobile ? (
          <CardActions sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, width: '100%' }}>
              <Button variant='contained' disabled={submitting || loading} onClick={handleSave} fullWidth={isMobile}>
                {saveLabel}
              </Button>
              <Button variant='outlined' disabled={submitting} onClick={() => router.push('/loan-cases')} fullWidth={isMobile}>
                Cancel
              </Button>
            </Box>
          </CardActions>
        ) : null}
      </Card>

      {isMobile ? (
        <Paper
          elevation={0}
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: theme.zIndex.appBar,
            borderTop: '1px solid',
            borderColor: 'divider',
            backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.92)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <Box sx={{ p: 1.5, display: 'flex', gap: 1.5 }}>
            <Button variant='outlined' disabled={submitting} onClick={() => router.push('/loan-cases')} fullWidth>
              Cancel
            </Button>
            <Button variant='contained' disabled={submitting || loading} onClick={handleSave} fullWidth>
              {saveLabel}
            </Button>
          </Box>
        </Paper>
      ) : null}

      <Dialog open={openAddCustomer} onClose={() => setOpenAddCustomer(false)} fullScreen={isMobile} maxWidth='sm' fullWidth>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          <CustomersCreateForm
            showTitle={!isMobile}
            variant='plain'
            onCancel={() => setOpenAddCustomer(false)}
            onSuccess={async () => {
              setOpenAddCustomer(false)
              await refreshCustomers()
            }}
            onSubmitOverride={async payload => {
              const res = await createCustomer(payload)

              setCustomerId(res.id)
            }}
            submitLabel='Create Customer'
          />
        </DialogContent>
      </Dialog>

      <Snackbar
        open={successOpen}
        autoHideDuration={3000}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSuccessOpen(false)}
          severity='success'
          variant='filled'
          icon={<i className='ri-checkbox-circle-line' />}
          sx={{
            width: '100%',
            color: 'text.primary',
            backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'rgb(var(--mui-palette-success-mainChannel) / 0.4)',
            boxShadow: '0 12px 30px rgb(0 0 0 / 0.12)',
            '& .MuiAlert-icon': {
              color: 'var(--mui-palette-success-main)'
            }
          }}
        >
          {successMsg}
        </Alert>
      </Snackbar>

      <Dialog open={redirectOpen} onClose={() => undefined} disableEscapeKeyDown>
        <DialogContent
          sx={{
            p: 3,
            width: { xs: 'calc(100vw - 32px)', sm: 420 }
          }}
        >
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)', color: 'success.main' }}>
                <i className='ri-checkbox-circle-line' />
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                  {successMsg}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Taking you back to Lead Manager...
                </Typography>
              </Box>
            </Box>
            <LinearProgress variant='determinate' value={redirectProgress} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant='caption' color='text.secondary'>
                Please wait
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {Math.round(redirectProgress)}%
              </Typography>
            </Box>
          </Stack>
        </DialogContent>
      </Dialog>
    </Box>
  )
}

export default LoanCaseForm
