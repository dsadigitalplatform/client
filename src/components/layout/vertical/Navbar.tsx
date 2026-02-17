import LayoutNavbar from '@layouts/components/vertical/Navbar'
import NavbarContent from './NavbarContent'

type UserInfo = {
  name?: string | null
  email?: string | null
  image?: string | null
}

type TenantInfo = {
  tenantName?: string
  role?: 'OWNER' | 'ADMIN' | 'USER'
}

const Navbar = ({ user, tenant }: { user?: UserInfo; tenant?: TenantInfo }) => {
  return (
    <LayoutNavbar>
      <NavbarContent user={user} tenant={tenant} />
    </LayoutNavbar>
  )
}

export default Navbar
