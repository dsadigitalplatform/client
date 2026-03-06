import type {
  Appointment,
  AppointmentStatus,
  CreateAppointmentInput,
  CreateFollowUpInput,
  GetAppointmentsParams,
  UpdateAppointmentInput
} from '@features/appointments/appointments.types'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {})
    }
  })

  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'request_failed') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data as T
}

function toIsoOrString(v: string | Date) {
  if (typeof v === 'string') return v

  return v.toISOString()
}

export type AppointmentListItem = Appointment & {
  customerName?: string | null
  leadTitle?: string | null
  organizerId?: string | null
  organizerName?: string | null
  organizerEmail?: string | null
}

export type AppointmentDetails = AppointmentListItem & {
  customer?: { id: string; fullName: string; mobile?: string | null; email?: string | null } | null
  lead?: { id: string; title?: string | null; loanTypeName?: string | null; bankName?: string | null } | null
}

export async function listAppointmentsByLead(leadId: string, params: Omit<GetAppointmentsParams, 'leadId'> = {}) {
  const url = new URL('/api/appointments', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  url.searchParams.set('leadId', leadId)

  if (params.organizerId) url.searchParams.set('organizerId', params.organizerId)
  if (params.status) url.searchParams.set('status', params.status as AppointmentStatus)
  if (params.dateFrom) url.searchParams.set('dateFrom', toIsoOrString(params.dateFrom))
  if (params.dateTo) url.searchParams.set('dateTo', toIsoOrString(params.dateTo))

  const data = await api<{ appointments: AppointmentListItem[] }>(url.toString(), { method: 'GET', cache: 'no-store' })

  return data.appointments ?? []
}

export async function listAppointments(params: GetAppointmentsParams = {}) {
  const url = new URL('/api/appointments', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.leadId) url.searchParams.set('leadId', params.leadId)
  if (params.organizerId) url.searchParams.set('organizerId', params.organizerId)
  if (params.status) url.searchParams.set('status', params.status as AppointmentStatus)
  if (params.dateFrom) url.searchParams.set('dateFrom', toIsoOrString(params.dateFrom))
  if (params.dateTo) url.searchParams.set('dateTo', toIsoOrString(params.dateTo))

  const data = await api<{ appointments: AppointmentListItem[] }>(url.toString(), { method: 'GET', cache: 'no-store' })

  return data.appointments ?? []
}

export async function getAppointmentById(appointmentId: string) {
  return api<AppointmentDetails>(`/api/appointments/${encodeURIComponent(appointmentId)}`, { method: 'GET' })
}

export async function updateAppointment(appointmentId: string, updateData: UpdateAppointmentInput) {
  const body = {
    ...updateData,
    ...(updateData.scheduledAt !== undefined
      ? { scheduledAt: updateData.scheduledAt ? toIsoOrString(updateData.scheduledAt) : null }
      : {})
  }

  return api<{ ok: true }>(`/api/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

export async function createFollowUpAppointment(appointmentId: string, appointmentData: CreateFollowUpInput) {
  return api<{ id: string }>(`/api/appointments/${encodeURIComponent(appointmentId)}/follow-up`, {
    method: 'POST',
    body: JSON.stringify({ ...appointmentData, scheduledAt: toIsoOrString(appointmentData.scheduledAt) })
  })
}

export async function createAppointment(appointmentData: CreateAppointmentInput) {
  return api<{ id: string }>('/api/appointments', {
    method: 'POST',
    body: JSON.stringify({ ...appointmentData, scheduledAt: toIsoOrString(appointmentData.scheduledAt) })
  })
}
