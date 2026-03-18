export type ReminderStatus = 'pending' | 'done' | 'skipped'

export type ReminderSource = 'CASE_FOLLOW_UP' | 'APPOINTMENT'

export type ReminderListItem = {
  id: string
  title: string
  description: string | null
  reminderDateTime: string
  status: ReminderStatus
  source: ReminderSource
  followUpType?: string | null
  userId: string
  caseId: string | null
  caseRef: string | null
  customerId: string | null
  customerName: string | null
  appointmentId: string | null
}

