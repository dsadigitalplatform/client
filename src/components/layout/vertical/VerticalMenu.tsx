// MUI Imports
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import { Menu, MenuItem, SubMenu } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

type RenderExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

type TenantInfo = {
  role?: 'OWNER' | 'ADMIN' | 'USER'
}

type Props = {
  scrollMenu: (container: any, isPerfectScrollbar: boolean) => void
  tenant?: TenantInfo
  isSuperAdmin?: boolean
  hasMembership?: boolean
  menuVisibility?: {
    showCustomers: boolean
    showAdmin: boolean
    showSuperAdmin: boolean
    canInviteUser: boolean
  }
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ scrollMenu, menuVisibility }: Props) => {
  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  const hasTenant = Boolean(menuVisibility?.showCustomers)
  const showSuperAdmin = Boolean(menuVisibility?.showSuperAdmin)
  const showAdmin = Boolean(menuVisibility?.showAdmin)
  const canInviteUser = Boolean(menuVisibility?.canInviteUser)

  return (
    // eslint-disable-next-line lines-around-comment
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
          className: 'bs-full overflow-y-auto overflow-x-hidden',
          onScroll: container => scrollMenu(container, false)
        }
        : {
          options: { wheelPropagation: false, suppressScrollX: true },
          onScrollY: container => scrollMenu(container, true)
        })}
    >

      <Menu
        popoutMenuOffset={{ mainAxis: 10 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        <MenuItem href='/home' icon={<i className='ri-home-smile-line' />}>
          Dashboard
        </MenuItem>

        {hasTenant && (
          <SubMenu label='Lead Management' icon={<i className='ri-team-line' />}>
            <MenuItem href='/customers' icon={<i className='ri-user-line' />}>
              Customer
            </MenuItem>
            <MenuItem href='/loan-types' icon={<i className='ri-file-list-3-line' />}>
              Loan Types
            </MenuItem>
            <MenuItem href='/loan-status-pipeline' icon={<i className='ri-flow-chart' />}>
              Loan Status Pipeline
            </MenuItem>
            <MenuItem href='/document-checklists' icon={<i className='ri-file-text-line' />}>
              Document Checklist
            </MenuItem>
          </SubMenu>
        )}

        {showSuperAdmin && (
          <SubMenu label='Super Admin' icon={<i className='ri-shield-star-line' />}>
            <MenuItem href='/super-admin/subscription-plans' icon={<i className='ri-price-tag-3-line' />}>
              Subscription Plans
            </MenuItem>
          </SubMenu>
        )}

        {showAdmin && (
          <SubMenu label='Admin' icon={<i className='ri-shield-user-line' />}>
            {canInviteUser && (
              <MenuItem href='/admin/invite-user' icon={<i className='ri-user-add-line' />}>
                Invite User
              </MenuItem>
            )}
            <MenuItem href='/create-tenant' icon={<i className='ri-building-2-line' />}>
              Create Organisation
            </MenuItem>
            <MenuItem href='/tenants' icon={<i className='ri-building-4-line' />}>
              Organisation Details
            </MenuItem>
          </SubMenu>
        )}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
