import type {
  ReferralCredit,
  ReferralInvite,
  ReferralPayoutDetails,
  ReferralProgramSettings,
  ReferralRewardsSummary,
  ReferralWithdrawal
} from '../referrals.types'

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    }
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err: any = new Error(data?.error || data?.message || 'request_failed')

    err.status = res.status
    err.data = data
    throw err
  }

  return data as T
}

export function getReferralSettings() {
  return jsonFetch<{ settings: ReferralProgramSettings }>('/api/referrals/settings')
}

export function updateReferralSettings(body: Partial<ReferralProgramSettings>) {
  return jsonFetch<{ settings: ReferralProgramSettings }>('/api/super-admin/referrals/settings', {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

export function createReferralInvite(body: {
  inviteeEmail: string
  inviteeMobile: string
  inviteeName?: string
}) {
  return jsonFetch<{ invite: ReferralInvite }>('/api/referrals/invites', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function getMyRewards() {
  return jsonFetch<{
    summary: ReferralRewardsSummary
    invites: ReferralInvite[]
    credits: ReferralCredit[]
    withdrawals: ReferralWithdrawal[]
  }>('/api/referrals/rewards')
}

export function requestReferralWithdrawal(body: { creditIds: string[]; payoutDetails: ReferralPayoutDetails }) {
  return jsonFetch<{ withdrawal: ReferralWithdrawal }>('/api/referrals/withdrawals', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function adminListReferrals(params?: { status?: string; q?: string; tab?: string }) {
  const sp = new URLSearchParams()

  if (params?.status) sp.set('status', params.status)
  if (params?.q) sp.set('q', params.q)
  if (params?.tab) sp.set('tab', params.tab)

  return jsonFetch<{
    invites: ReferralInvite[]
    credits: ReferralCredit[]
    withdrawals: ReferralWithdrawal[]
  }>(`/api/super-admin/referrals?${sp.toString()}`)
}

export function adminLinkReferral(body: {
  referredTenantId: string
  referrerUserId: string
  referralInviteId?: string | null
  inviteeEmail?: string | null
  inviteeMobile?: string | null
  inviteeName?: string | null
}) {
  return jsonFetch<{ invite: ReferralInvite }>('/api/super-admin/referrals/link', {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function adminUpdateInvite(inviteId: string, body: { commissionPercentOverride?: number | null; commissionCancelled?: boolean }) {
  return jsonFetch<{ invite: ReferralInvite }>(`/api/super-admin/referrals/invites/${inviteId}`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  })
}

export function adminResolveWithdrawal(withdrawalId: string, body: { action: 'paid' | 'rejected'; note?: string }) {
  return jsonFetch<{ withdrawal: ReferralWithdrawal }>(`/api/super-admin/referrals/withdrawals/${withdrawalId}`, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

export function adminVoidCredit(creditId: string) {
  return jsonFetch<{ credit: ReferralCredit }>(`/api/super-admin/referrals/credits/${creditId}/void`, {
    method: 'POST'
  })
}

export function searchReferralUsers(q: string, tenantId?: string) {
  const sp = new URLSearchParams()

  if (q) sp.set('q', q)
  if (tenantId) sp.set('tenantId', tenantId)

  return jsonFetch<{ users: { id: string; name: string; email: string; role?: string }[] }>(
    `/api/super-admin/referrals/users?${sp.toString()}`
  )
}

