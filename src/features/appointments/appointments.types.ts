export type AppointmentFollowUpType = 'CALL' | 'WHATSAPP' | 'VISIT' | 'EMAIL'

export type AppointmentStatus = 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED' | 'NO_SHOW'

export type AppointmentOutcomeHistoryEntry = {
  status: string
  outcomeComments: string | null
  changedAt: string | null
  changedBy: string | null
}

export type Appointment = {
  id: string
  leadId: string | null
  customerId: string | null
  caseId: string | null
  scheduledAt: string | null
  durationMinutes: number
  followUpType: AppointmentFollowUpType | string | null
  status: AppointmentStatus | string
  outcomeComments: string | null
  outcomeHistory: AppointmentOutcomeHistoryEntry[]
  assignedTo: string | null
  createdBy: string | null
  parentAppointmentId: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type CreateAppointmentInput = {
  leadId: string
  customerId: string
  caseId?: string | null
  scheduledAt: string | Date
  durationMinutes?: number
  followUpType: AppointmentFollowUpType
  assignedTo?: string | null
  outcomeComments?: string | null
  notes?: string | null
}

export type UpdateAppointmentInput = {
  scheduledAt?: string | Date
  durationMinutes?: number | null
  status?: AppointmentStatus
  outcomeComments?: string | null
  assignedTo?: string | null
}

export type GetAppointmentsParams = {
  leadId?: string
  assignedTo?: string
  status?: AppointmentStatus
  dateFrom?: string | Date
  dateTo?: string | Date
}

export type CreateFollowUpInput = {
  scheduledAt: string | Date
  durationMinutes?: number
  followUpType: AppointmentFollowUpType
  assignedTo?: string | null
}
