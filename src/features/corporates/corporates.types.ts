export type Corporate = {
  id: string
  code: string
  name: string
  isActive: boolean
  createdAt: string | null
  canManage?: boolean
}
