'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import { useSession } from 'next-auth/react'

import dayjs, { type Dayjs } from 'dayjs'

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import Badge from '@mui/material/Badge'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActions from '@mui/material/CardActions'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
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
import type { AppointmentFollowUpType } from '@features/appointments/appointments.types'
import { createAppointment } from '@features/appointments/services/appointments'
import LeadAppointmentsDashboard from '@features/appointments/components/LeadAppointmentsDashboard'
import {
  createLoanCase,
  getLoanCases,
  getChecklistByLoanType,
  getLoanCaseById,
  getTenantUsers,
  updateLoanCase,
  deleteLoanCase
} from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseDetails, LoanCaseDocument, LoanCaseDocumentStatus, TenantUserOption } from '@features/loan-cases/loan-cases.types'

type StageOption = { id: string; name: string; order: number }
type DraftAppointment = {
  id: string
  scheduledAt: string
  followUpType: AppointmentFollowUpType | ''
  outcomeComments: string
  customerName: string
}

type Props = {
  caseId?: string
}

const DOCUMENT_STATUS_OPTIONS: Array<{ value: LoanCaseDocumentStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COLLECTED', label: 'Collected' },
  { value: 'SUBMITTED_TO_BANK', label: 'Submitted to Bank' },
  { value: 'APPROVED', label: 'Approved' }
]

const CREATE_CUSTOMER_OPTION_ID = '__create_customer__'

const CREATE_CUSTOMER_OPTION: Customer = {
  id: CREATE_CUSTOMER_OPTION_ID,
  fullName: 'Add New Customer',
  countryCode: '+91',
  mobile: '',
  isNRI: false,
  email: null,
  remarks: null,
  employmentType: 'SALARIED',
  monthlyIncome: null,
  cibilScore: null,
  source: 'OTHER',
  createdAt: null
}

const LoanCaseForm = ({ caseId }: Props) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [id, setId] = useState<string | null>(caseId ?? null)
  const [isLocked, setIsLocked] = useState(false)
  const [isActive, setIsActive] = useState<boolean>(true)

  const { customers, loading: customersLoading, setSearch, refresh: refreshCustomers } = useCustomers()

  const [customerValue, setCustomerValue] = useState<Customer | null>(null)
  const [customerInputValue, setCustomerInputValue] = useState<string>('')
  const [customerId, setCustomerId] = useState<string>('')
  const [loanTypeId, setLoanTypeId] = useState<string>('')
  const [stageId, setStageId] = useState<string>('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')

  const [bankName, setBankName] = useState<string>('')
  const [bankNameOptions, setBankNameOptions] = useState<string[]>([])
  const [requestedAmount, setRequestedAmount] = useState<string>('')
  const [eligibleAmount, setEligibleAmount] = useState<string>('')
  const [interestRate, setInterestRate] = useState<string>('')
  const [tenureMonths, setTenureMonths] = useState<string>('')
  const [emi, setEmi] = useState<string>('')

  const [documents, setDocuments] = useState<LoanCaseDocument[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)

  const [openAddCustomer, setOpenAddCustomer] = useState(false)

  const [draftAppointments, setDraftAppointments] = useState<DraftAppointment[]>([])
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false)
  const [editingDraftAppointmentId, setEditingDraftAppointmentId] = useState<string | null>(null)
  const [apptScheduledAt, setApptScheduledAt] = useState('')
  const [apptFollowUpType, setApptFollowUpType] = useState<DraftAppointment['followUpType']>('')
  const [apptOutcomeComments, setApptOutcomeComments] = useState('')
  const [apptErrors, setApptErrors] = useState<Record<string, string>>({})
  const [appointmentsRefreshKey, setAppointmentsRefreshKey] = useState(0)
  const [hasExistingAppointments, setHasExistingAppointments] = useState(Boolean(caseId))

  const apptScheduledAtValue = useMemo(() => {
    if (!apptScheduledAt) return null
    const d = dayjs(apptScheduledAt)

    return d.isValid() ? d : null
  }, [apptScheduledAt])

  const selectedLoanType = useMemo(() => loanTypes.find(l => l.id === loanTypeId) ?? null, [loanTypes, loanTypeId])
  const stageOptions = useMemo(() => stages.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [stages])
  const userOptions = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users])

  const assignedAgentLabel = useMemo(() => {
    if (!assignedAgentId) return 'Unassigned'

    const agent = userOptions.find(u => u.id === assignedAgentId)

    return agent?.name || agent?.email || 'Assigned Agent'
  }, [assignedAgentId, userOptions])

  const selectedCustomerLabel = useMemo(() => {
    if (customerValue?.fullName) return customerValue.fullName

    const match = customers.find(c => c.id === customerId)

    return match?.fullName || ''
  }, [customerId, customerValue?.fullName, customers])

  const customerOptions = useMemo(() => [...customers, CREATE_CUSTOMER_OPTION], [customers])

  const canOpenAppointmentDialog = Boolean(customerId && (id ? true : assignedAgentId))
  const appointmentUiLocked = !id && isLocked
  const sessionUserId = (session as any)?.userId as string | undefined

  useEffect(() => {
    if (caseId) return
    if (customerId) return
    const qp = searchParams.get('customerId')

    if (!qp) return

    setCustomerId(qp)
  }, [caseId, customerId, searchParams])

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
          countryCode: '+91',
          mobile: '',
          isNRI: false,
          email: null,
          remarks: null,
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
        setIsActive(Boolean(data.isActive))
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

  useEffect(() => {
    if (caseId) return
    if (id) return
    if (stageId) return
    if (stageOptions.length === 0) return

    setStageId(stageOptions[0].id)
  }, [caseId, id, stageId, stageOptions])

  useEffect(() => {
    if (caseId) return
    if (id) return
    if (assignedAgentId) return
    if (!sessionUserId) return
    if (!userOptions.some(u => u.id === sessionUserId)) return

    setAssignedAgentId(sessionUserId)
  }, [assignedAgentId, caseId, id, sessionUserId, userOptions])

  useEffect(() => {

    void (async () => {
      try {
        const cases = await getLoanCases()
        const byKey = new Map<string, string>()

        cases.forEach(c => {
          const value = (c.bankName || '').trim()

          if (!value) return
          const key = value.toLowerCase()

          if (!byKey.has(key)) byKey.set(key, value)
        })

        setBankNameOptions(Array.from(byKey.values()).sort((a, b) => a.localeCompare(b)))
      } catch {
        setBankNameOptions([])
      }
    })()
  }, [])

  const followUpMeta = (type: DraftAppointment['followUpType']) => {
    switch (type) {
      case 'CALL':
        return { label: 'Call', icon: 'ri-phone-line' }
      case 'WHATSAPP':
        return { label: 'WhatsApp', icon: 'ri-whatsapp-line' }
      case 'VISIT':
        return { label: 'Visit', icon: 'ri-map-pin-line' }
      case 'EMAIL':
        return { label: 'Email', icon: 'ri-mail-line' }
      default:
        return { label: '-', icon: 'ri-calendar-event-line' }
    }
  }

  const openDraftAppointment = (a: DraftAppointment) => {
    setEditingDraftAppointmentId(a.id)
    setApptScheduledAt(a.scheduledAt)
    setApptFollowUpType(a.followUpType)
    setApptOutcomeComments(a.outcomeComments)
    setApptErrors({})
    setAppointmentDialogOpen(true)
  }

  const addAppointment = async () => {
    const next: Record<string, string> = {}

    if (!customerId) next.customerId = 'Select a customer first'
    if (!apptScheduledAt) next.scheduledAt = 'Date & time is required'
    if (!apptFollowUpType) next.followUpType = 'Follow-up type is required'

    const scheduledAtDate = apptScheduledAt ? new Date(apptScheduledAt) : null

    if (scheduledAtDate && Number.isNaN(scheduledAtDate.getTime())) next.scheduledAt = 'Invalid date & time'
    if (scheduledAtDate && scheduledAtDate.getTime() <= Date.now()) next.scheduledAt = 'Date & time must be in the future'

    setApptErrors(next)
    if (Object.keys(next).length > 0) return

    if (id) {
      try {
        await createAppointment({
          leadId: id,
          customerId,
          caseId: id,
          scheduledAt: apptScheduledAt,
          followUpType: apptFollowUpType as AppointmentFollowUpType,
          outcomeComments: apptOutcomeComments.trim().length === 0 ? null : apptOutcomeComments.trim(),
          notes: apptOutcomeComments.trim().length === 0 ? null : apptOutcomeComments.trim()
        })

        setSuccessMsg('Appointment added')
        setSuccessOpen(true)
        setAppointmentsRefreshKey(v => v + 1)
      } catch (e: any) {
        setError(e?.message || 'Failed to add appointment')

        return
      } finally {
        setEditingDraftAppointmentId(null)
        setApptScheduledAt('')
        setApptFollowUpType('')
        setApptOutcomeComments('')
        setApptErrors({})
        setAppointmentDialogOpen(false)
      }

      return
    }

    if (editingDraftAppointmentId) {
      setDraftAppointments(prev =>
        prev.map(a =>
          a.id === editingDraftAppointmentId
            ? {
              ...a,
              scheduledAt: apptScheduledAt,
              followUpType: apptFollowUpType,
              outcomeComments: apptOutcomeComments,
              customerName: selectedCustomerLabel || 'Customer'
            }
            : a
        )
      )
    } else {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`

      setDraftAppointments(prev => [
        ...prev,
        {
          id,
          scheduledAt: apptScheduledAt,
          followUpType: apptFollowUpType,
          outcomeComments: apptOutcomeComments,
          customerName: selectedCustomerLabel || 'Customer'
        }
      ])
    }

    setEditingDraftAppointmentId(null)
    setApptScheduledAt('')
    setApptFollowUpType('')
    setApptOutcomeComments('')
    setApptErrors({})
    setAppointmentDialogOpen(false)
  }

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

    if (!id && draftAppointments.length === 0) next.appointments = 'At least one appointment is required'

    setFieldErrors(next)

    return { ok: Object.keys(next).length === 0, parsed: { requested, eligible, rate, tenure, emiN } }
  }

  const handleDelete = async () => {
    if (!id) return
    setDeleting(true)

    try {
      await deleteLoanCase(id)
      setSuccessMsg('Loan case deleted successfully')
      setRedirectTarget('/loan-cases')
      setRedirectOpen(true)
      setConfirmDeleteOpen(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to delete loan case')
      setConfirmDeleteOpen(false)
    } finally {
      setDeleting(false)
    }
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

        try {
          for (const a of draftAppointments) {
            await createAppointment({
              leadId: res.id,
              customerId,
              caseId: res.id,
              scheduledAt: a.scheduledAt,
              followUpType: a.followUpType as AppointmentFollowUpType,
              outcomeComments: a.outcomeComments.trim().length === 0 ? null : a.outcomeComments.trim(),
              notes: a.outcomeComments.trim().length === 0 ? null : a.outcomeComments.trim()
            })
          }
        } catch (e: any) {
          setIsLocked(true)
          setError(e?.message || 'Lead was created but appointments could not be created')

          return
        }

        setIsLocked(true)
        setDraftAppointments([])

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

  const headerTitle = id ? (isActive ? 'Lead manager' : 'Lead manager (Inactive)') : 'Create Lead'
  const headerSub = id ? (isActive ? 'Update lead' : 'This lead has been deleted and cannot be modified') : 'Create & link a new lead '

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
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {headerTitle}

            </Box>
          }

          sx={{
            ...(id && !isActive && {
              backgroundColor: 'error.light',
              color: 'error.contrastText',
              '& .MuiCardHeader-subheader': {
                color: 'error.contrastText'
              }
            })
          }}
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
          ) : id && !isActive ? (
            <>
              <Alert
                severity="warning"
                icon={<i className="ri-error-warning-line" />}
                sx={{ mb: 3 }}
              >
                <Typography variant="body2" fontWeight="bold">
                  This lead has been deleted and is no longer active.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  You can view the details but cannot make changes or delete this record.
                </Typography>
              </Alert>

              {/* Read-only details summary */}
              <Card variant="outlined" sx={{ mb: 3, backgroundColor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <i className="ri-information-line" />
                    Lead Details (Read Only)
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">Customer</Typography>
                      <Typography variant="body1">{customerValue?.fullName || 'N/A'}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">Loan Type</Typography>
                      <Typography variant="body1">{loanTypes.find(lt => lt.id === loanTypeId)?.name || 'N/A'}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">Bank/NBFC</Typography>
                      <Typography variant="body1">{bankName || 'N/A'}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">Requested Amount</Typography>
                      <Typography variant="body1">{requestedAmount ? `₹${Number(requestedAmount).toLocaleString('en-IN')}` : 'N/A'}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">Stage</Typography>
                      <Typography variant="body1">{stages.find(s => s.id === stageId)?.name || 'N/A'}</Typography>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography variant="body2" fontWeight="bold" color="text.secondary">Assigned Agent</Typography>
                      <Typography variant="body1">
                        {users.find(u => u.id === assignedAgentId)?.name ||
                          users.find(u => u.id === assignedAgentId)?.email ||
                          'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </>
          ) : (
            <Stack spacing={isMobile ? 3.5 : 3.5}>


              <Divider />

              <Grid container rowSpacing={{ xs: 3, sm: 3 }} columnSpacing={{ xs: 2, sm: 3 }}>
                <Grid size={{ xs: 12 }}>
                  <Autocomplete
                    options={customerOptions}
                    value={customerValue}
                    loading={customersLoading}
                    getOptionLabel={o =>
                      o.id === CREATE_CUSTOMER_OPTION_ID ? o.fullName : `${o.fullName}${o.mobile ? ` (${o.mobile})` : ''}`
                    }
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    onChange={(_, v) => {
                      if (v?.id === CREATE_CUSTOMER_OPTION_ID) {
                        setOpenAddCustomer(true)

                        return
                      }

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
                    disabled={isLocked || !isActive}
                    renderOption={(props, option) => (
                      <Box
                        component='li'
                        {...props}
                        sx={
                          option.id === CREATE_CUSTOMER_OPTION_ID
                            ? {
                              position: 'sticky',
                              bottom: 0,
                              zIndex: 1,
                              borderTop: '1px solid',
                              borderColor: 'divider',
                              bgcolor: 'background.paper',
                              fontWeight: 700,
                              color: 'primary.main',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 1,
                              py: 1.25
                            }
                            : undefined
                        }
                      >
                        {option.id === CREATE_CUSTOMER_OPTION_ID ? <i className='ri-user-add-line' /> : null}
                        {option.id === CREATE_CUSTOMER_OPTION_ID
                          ? 'Add New Customer'
                          : `${option.fullName}${option.mobile ? ` (${option.mobile})` : ''}`}
                      </Box>
                    )}
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

                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth size='small' error={!!fieldErrors.loanTypeId}>
                    <InputLabel id='loan-case-loan-type'>Loan Type</InputLabel>
                    <Select
                      labelId='loan-case-loan-type'
                      label='Loan Type'
                      value={loanTypeId}
                      onChange={e => setLoanTypeId(String(e.target.value))}
                      disabled={isLocked || !isActive}
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
                  <Autocomplete
                    freeSolo
                    options={bankNameOptions}
                    value={bankName}
                    onChange={(_, v) => setBankName(typeof v === 'string' ? v : '')}
                    inputValue={bankName}
                    onInputChange={(_, v) => setBankName(v)}
                    disabled={isLocked || !isActive}
                    renderInput={params => (
                      <TextField
                        {...params}
                        label='Bank / NBFC'
                        fullWidth
                        size='small'
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position='start'>
                              <i className='ri-bank-line' />
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
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
                    Appointments
                  </Typography>
                  {!isMobile ? (
                    <Typography variant='body2' color='text.secondary'>
                      {id ? 'Add appointments and follow-ups right here' : 'Add at least one appointment before saving this lead'}
                    </Typography>
                  ) : null}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {!id || !hasExistingAppointments ? (
                      isMobile ? (
                        <Badge
                          badgeContent={id ? 0 : draftAppointments.length}
                          color='error'
                          invisible={id ? true : draftAppointments.length === 0}
                          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                          sx={{
                            '& .MuiBadge-badge': {
                              fontWeight: 800,
                              minWidth: 22,
                              height: 22,
                              borderRadius: 999,
                              border: '2px solid',
                              borderColor: 'background.paper',
                              top: 4,
                              right: 2
                            }
                          }}
                        >
                          <IconButton
                            onClick={() => {
                              setEditingDraftAppointmentId(null)
                              setApptScheduledAt('')
                              setApptFollowUpType('')
                              setApptOutcomeComments('')
                              setApptErrors({})
                              setAppointmentDialogOpen(true)
                            }}
                            disabled={appointmentUiLocked || !canOpenAppointmentDialog}
                            aria-label='Add appointment'
                            sx={{
                              width: 46,
                              height: 46,
                              color: 'common.white',
                              background: 'linear-gradient(135deg, var(--mui-palette-primary-main), var(--mui-palette-info-main))',
                              boxShadow: '0 10px 24px rgb(var(--mui-palette-primary-mainChannel) / 0.32)',
                              '&:hover': {
                                background: 'linear-gradient(135deg, var(--mui-palette-primary-dark), var(--mui-palette-info-dark))',
                                boxShadow: '0 14px 28px rgb(var(--mui-palette-primary-mainChannel) / 0.4)'
                              }
                            }}
                          >
                            <i className='ri-calendar-event-line' />
                          </IconButton>
                        </Badge>
                      ) : (
                        <Badge
                          badgeContent={id ? 0 : draftAppointments.length}
                          color='error'
                          invisible={id ? true : draftAppointments.length === 0}
                          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                          sx={{
                            '& .MuiBadge-badge': {
                              fontWeight: 800,
                              minWidth: 22,
                              height: 22,
                              borderRadius: 999,
                              border: '2px solid',
                              borderColor: 'background.paper',
                              top: 4,
                              right: 6
                            }
                          }}
                        >
                          <Button
                            variant='contained'
                            startIcon={<i className='ri-calendar-event-line' />}
                            onClick={() => {
                              setEditingDraftAppointmentId(null)
                              setApptScheduledAt('')
                              setApptFollowUpType('')
                              setApptOutcomeComments('')
                              setApptErrors({})
                              setAppointmentDialogOpen(true)
                            }}
                            disabled={appointmentUiLocked || !canOpenAppointmentDialog}
                            sx={{
                              borderRadius: 999,
                              px: 2.25,
                              background: 'linear-gradient(95deg, var(--mui-palette-primary-main), var(--mui-palette-info-main))',
                              boxShadow: '0 10px 24px rgb(var(--mui-palette-primary-mainChannel) / 0.32)',
                              '&:hover': {
                                boxShadow: '0 14px 28px rgb(var(--mui-palette-primary-mainChannel) / 0.4)'
                              }
                            }}
                          >
                            Add Appointment
                          </Button>
                        </Badge>
                      )
                    ) : null}
                  </Box>
                </Box>
              </Box>

              {fieldErrors.appointments ? (
                <Alert severity='error' sx={{ mt: 0.5 }}>
                  {fieldErrors.appointments}
                </Alert>
              ) : null}

              {!id ? (
                <Paper variant='outlined' sx={{ borderRadius: 2.5, p: { xs: 2, sm: 2.5 } }}>
                  {draftAppointments.length === 0 ? (
                    <Box
                      sx={{
                        border: '1px dashed',
                        borderColor: 'divider',
                        borderRadius: 2.5,
                        p: { xs: 2, sm: 2.5 },
                        bgcolor: 'background.default'
                      }}
                    >
                      <Typography variant='body2' color='text.secondary'>
                        No appointments added yet. Use Add Appointment to schedule the first touchpoint.
                      </Typography>
                    </Box>
                  ) : null}
                  {draftAppointments.length > 0 ? (
                    isMobile ? (
                      <Stack spacing={1.5}>
                        {draftAppointments.map(a => (
                          <Card
                            key={a.id}
                            variant='outlined'
                            onClick={() => openDraftAppointment(a)}
                            sx={{
                              borderRadius: 2.5,
                              boxShadow: 'none',
                              borderColor: 'divider',
                              cursor: 'pointer'
                            }}
                          >
                            <CardContent sx={{ p: 2 }}>
                              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1.5 }}>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant='body2' sx={{ fontWeight: 800 }} noWrap title={a.customerName}>
                                    {a.customerName}
                                  </Typography>
                                  <Typography variant='caption' color='text.secondary' sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <i className={followUpMeta(a.followUpType).icon} />
                                    {followUpMeta(a.followUpType).label}
                                  </Typography>
                                  <Typography variant='body2' sx={{ mt: 0.5 }}>
                                    {dayjs(a.scheduledAt).isValid() ? dayjs(a.scheduledAt).format('DD MMM YYYY, hh:mm A') : a.scheduledAt}
                                  </Typography>
                                  <Typography variant='caption' color='text.secondary'>
                                    Organizer: {assignedAgentLabel}
                                  </Typography>
                                </Box>
                                <IconButton
                                  size='small'
                                  onClick={e => {
                                    e.stopPropagation()
                                    setDraftAppointments(prev => prev.filter(x => x.id !== a.id))
                                  }}
                                  aria-label='Remove appointment'
                                  disabled={isLocked || !isActive}
                                >
                                  <i className='ri-close-line' />
                                </IconButton>
                              </Box>
                              {a.outcomeComments.trim().length > 0 ? (
                                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                                  {a.outcomeComments}
                                </Typography>
                              ) : null}
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    ) : (
                      <Paper variant='outlined' sx={{ borderRadius: 2.5, overflow: 'hidden', mt: 0.5 }}>
                        <Table size='small'>
                          <TableHead>
                            <TableRow>
                              <TableCell>Customer Name</TableCell>
                              <TableCell>Follow-up Type</TableCell>
                              <TableCell>Date & Time</TableCell>
                              <TableCell>Organizer</TableCell>
                              <TableCell width={90} align='right'>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {draftAppointments.map(a => (
                              <TableRow key={a.id} hover onClick={() => openDraftAppointment(a)} sx={{ cursor: 'pointer' }}>
                                <TableCell>
                                  <Typography variant='body2' sx={{ fontWeight: 700 }} noWrap title={a.customerName}>
                                    {a.customerName}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <i className={followUpMeta(a.followUpType).icon} />
                                    <Typography variant='body2'>{followUpMeta(a.followUpType).label}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>{dayjs(a.scheduledAt).isValid() ? dayjs(a.scheduledAt).format('DD MMM YYYY, hh:mm A') : a.scheduledAt}</TableCell>
                                <TableCell>{assignedAgentLabel}</TableCell>
                                <TableCell align='right'>
                                  <IconButton
                                    size='small'
                                    onClick={e => {
                                      e.stopPropagation()
                                      setDraftAppointments(prev => prev.filter(x => x.id !== a.id))
                                    }}
                                    aria-label='Remove appointment'
                                    disabled={isLocked || !isActive}
                                  >
                                    <i className='ri-close-line' />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    )
                  ) : null}
                </Paper>
              ) : (
                <Box sx={{ mt: 1.5 }}>
                  <LeadAppointmentsDashboard
                    leadId={id}
                    embedded
                    refreshKey={appointmentsRefreshKey}
                    onLoaded={count => setHasExistingAppointments(count > 0)}
                  />
                </Box>
              )}

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
              <Button variant='contained' disabled={submitting || loading || !isActive} onClick={handleSave} fullWidth={isMobile}>
                {saveLabel}
              </Button>
              {id && isActive && (
                <Button
                  variant='outlined'
                  color='error'
                  disabled={submitting || deleting}
                  onClick={() => setConfirmDeleteOpen(true)}
                  fullWidth={isMobile}
                  startIcon={<i className='ri-delete-bin-line' />}
                >
                  Delete
                </Button>
              )}
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
            {id && isActive && (
              <Button
                variant='outlined'
                color='error'
                disabled={submitting || deleting}
                onClick={() => setConfirmDeleteOpen(true)}
                fullWidth
              >
                <i className='ri-delete-bin-line' />
              </Button>
            )}
            <Button variant='contained' disabled={submitting || loading || !isActive} onClick={handleSave} fullWidth>
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

      <Dialog
        open={appointmentDialogOpen}
        onClose={() => setAppointmentDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Typography variant='h6' sx={{ fontWeight: 800 }}>
            {editingDraftAppointmentId ? 'Edit Appointment' : 'Add Appointment'}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
            Organizer: {assignedAgentLabel}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: { xs: 2.5, sm: 3 }, pb: 1 }}>
          <Grid container rowSpacing={{ xs: 2, sm: 2.5 }} columnSpacing={{ xs: 2, sm: 2.5 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label='Customer'
                value={selectedCustomerLabel || 'Select customer first'}
                size='small'
                fullWidth
                InputLabelProps={{ shrink: true }}
                InputProps={{ readOnly: true }}
                error={!!apptErrors.customerId}
                helperText={apptErrors.customerId}
                sx={{
                  mt: 0.5,
                  '& .MuiInputLabel-root': {
                    fontWeight: 600
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  label='Date & Time'
                  value={apptScheduledAtValue}
                  onChange={(v: Dayjs | null) => setApptScheduledAt(v && v.isValid() ? v.format('YYYY-MM-DDTHH:mm') : '')}
                  format='YYYY-MM-DD HH:mm'
                  minutesStep={30}
                  disablePast
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                      error: !!apptErrors.scheduledAt,
                      helperText: apptErrors.scheduledAt,
                      disabled: appointmentUiLocked,
                      sx: {
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: 2
                          }
                        }
                      }
                    }
                  }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl size='small' fullWidth error={!!apptErrors.followUpType}>
                <InputLabel id='loan-case-appt-followup'>Follow-up Type</InputLabel>
                <Select
                  labelId='loan-case-appt-followup'
                  label='Follow-up Type'
                  value={apptFollowUpType}
                  onChange={e => setApptFollowUpType(String(e.target.value).toUpperCase() as any)}
                  disabled={appointmentUiLocked}
                  renderValue={value => {
                    const meta = followUpMeta(String(value).toUpperCase() as DraftAppointment['followUpType'])

                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <i className={meta.icon} />
                        <span>{meta.label}</span>
                      </Box>
                    )
                  }}
                >
                  <MenuItem value='CALL'>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <i className='ri-phone-line' />
                      <span>Call</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value='WHATSAPP'>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <i className='ri-whatsapp-line' />
                      <span>WhatsApp</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value='VISIT'>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <i className='ri-map-pin-line' />
                      <span>Visit</span>
                    </Box>
                  </MenuItem>
                  <MenuItem value='EMAIL'>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <i className='ri-mail-line' />
                      <span>Email</span>
                    </Box>
                  </MenuItem>
                </Select>
                {apptErrors.followUpType ? (
                  <Typography variant='caption' color='error' sx={{ display: 'block', mt: 0.75 }}>
                    {apptErrors.followUpType}
                  </Typography>
                ) : null}
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label='Outcome / comments'
                value={apptOutcomeComments}
                onChange={e => setApptOutcomeComments(e.target.value)}
                size='small'
                fullWidth
                multiline
                minRows={2}
                disabled={appointmentUiLocked}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant='outlined'
            onClick={() => {
              setAppointmentDialogOpen(false)
              setEditingDraftAppointmentId(null)
              setApptErrors({})
            }}
            disabled={appointmentUiLocked}
          >
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={() => void addAppointment()}
            disabled={appointmentUiLocked || !canOpenAppointmentDialog}
          >
            {editingDraftAppointmentId ? 'Update Appointment' : 'Save Appointment'}
          </Button>
        </DialogActions>
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

      <Dialog open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)}>
        <DialogTitle>Delete Loan Case</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this loan case? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button variant='text' onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color='error' variant='contained' onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default LoanCaseForm
