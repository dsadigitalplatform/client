export type AssociateType = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string | null
  canManage?: boolean
}
