export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED'
export type SourceType = 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'

export type Customer = {
  id: string
  fullName: string
  mobile: string
  email: string | null
  employmentType: EmploymentType
  monthlyIncome: number | null
  cibilScore: number | null
  source: SourceType
  createdAt: string | null
}
