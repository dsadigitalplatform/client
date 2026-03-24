export type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED'
export type SourceType = 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'
export type SecondaryContactType = 'ALTERNATE' | 'SPOUSE' | 'FRIEND' | 'RELATIVE' | 'OTHER'

export type SecondaryContact = {
  countryCode: string
  mobile: string
  type: SecondaryContactType
}

export type Customer = {
  id: string
  fullName: string
  countryCode: string
  mobile: string
  isNRI: boolean
  email: string | null
  remarks: string | null
  secondaryContacts?: SecondaryContact[]
  employmentType: EmploymentType
  monthlyIncome: number | null
  cibilScore: number | null
  source: SourceType
  createdAt: string | null
}
