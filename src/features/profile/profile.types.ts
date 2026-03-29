export type UserProfile = {
  id?: string
  name: string
  email: string
  image?: string | null
  countryCode?: string | null
  mobile?: string | null
  notifyMe?: boolean | null
}

export type UpdateProfileInput = {
  name: string
  image?: string | null
  countryCode?: string | null
  mobile?: string | null
  notifyMe?: boolean | null
}
