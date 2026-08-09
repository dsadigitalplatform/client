export type ReferralInviteStatus = 'invited' | 'onboarded' | 'subscribed' | 'paid' | 'cancelled'

export type ReferralCreditStatus = 'available' | 'locked' | 'withdrawn' | 'void'

export type ReferralWithdrawalStatus = 'requested' | 'paid' | 'rejected'

export type ReferralPayoutMethod = 'upi' | 'bank'

export type ReferralProgramSettings = {
  id: string
  commissionPercent: number
  headline: string
  subheadline: string
  benefits: string[]
  termsHtml: string
  ctaLabel: string
  updatedAt: string
  updatedByUserId: string | null
}

export type ReferralPayoutDetails = {
  method: ReferralPayoutMethod
  upiId?: string | null
  accountName?: string | null
  accountNumber?: string | null
  ifsc?: string | null
}

export type ReferralInvite = {
  id: string
  referrerUserId: string
  referrerTenantId: string | null
  inviteeName: string | null
  inviteeEmail: string
  inviteeMobile: string
  token: string
  status: ReferralInviteStatus
  referredTenantId: string | null
  onboardedAt: string | null
  subscribedAt: string | null
  lastCreditedAt: string | null
  commissionPercentOverride: number | null
  commissionCancelled: boolean
  createdAt: string
  updatedAt: string
  /** Enriched (optional) */
  referrerName?: string | null
  referrerEmail?: string | null
  referredTenantName?: string | null
  effectiveCommissionPercent?: number
}

export type ReferralCredit = {
  id: string
  referralInviteId: string
  referrerUserId: string
  referredTenantId: string
  sourceInvoiceId: string | null
  sourcePaymentNote: string | null
  subscriptionAmount: number
  commissionPercent: number
  commissionAmount: number
  status: ReferralCreditStatus
  withdrawalId: string | null
  createdAt: string
  createdByUserId: string
  referredTenantName?: string | null
  inviteeEmail?: string | null
}

export type ReferralWithdrawal = {
  id: string
  referrerUserId: string
  creditIds: string[]
  amount: number
  payoutDetails: ReferralPayoutDetails
  status: ReferralWithdrawalStatus
  note: string | null
  requestedAt: string
  resolvedAt: string | null
  resolvedByUserId: string | null
  referrerName?: string | null
  referrerEmail?: string | null
}

export type ReferralRewardsSummary = {
  availableBalance: number
  pendingWithdrawal: number
  lifetimeEarned: number
  openInvites: number
  totalReferrals: number
}

export const DEFAULT_REFERRAL_SETTINGS: Omit<ReferralProgramSettings, 'id' | 'updatedAt' | 'updatedByUserId'> = {
  commissionPercent: 10,
  headline: 'Refer a Direct Sales Agent',
  subheadline:
    'Invite another DSA to our platform. Earn recurring commission whenever they pay their subscription — help peers grow while you earn.',
  benefits: [
    'Share a personalised invite with email and mobile',
    'Earn recurring commission on every paid subscription',
    'Track every referral from invite to payout in Rewards',
    'Request withdrawals when your balance is ready'
  ],
  termsHtml: `<p>Commission is a recurring percentage of each paid subscription amount for organisations attributed to your referral. The platform Super Admin may modify the commission rate or cancel commission on any referral at any time. Credits appear after a subscription payment is recorded. Withdrawals are settled manually after review. This program does not create employment or partnership.</p>`,
  ctaLabel: 'Invite a DSA'
}
