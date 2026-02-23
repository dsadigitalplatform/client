export type TenantRole = 'OWNER' | 'ADMIN' | 'USER' | undefined
export type MenuVisibility = {
  showCustomers: boolean
  showAdmin: boolean
  showSuperAdmin: boolean
  canInviteUser: boolean
}

export function getMenuVisibility(params: { isSuperAdmin?: boolean; tenantRole?: TenantRole; hasTenantSelected: boolean }): MenuVisibility {
  const isSuper = Boolean(params.isSuperAdmin)
  const role = params.tenantRole
  const hasTenant = Boolean(params.hasTenantSelected)

  const canInvite = role === 'OWNER' || role === 'ADMIN'

  return {
    showCustomers: hasTenant,
    showAdmin: true,
    showSuperAdmin: isSuper,
    canInviteUser: canInvite
  }
}
