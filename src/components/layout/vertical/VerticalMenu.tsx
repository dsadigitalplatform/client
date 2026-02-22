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
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ scrollMenu, tenant, isSuperAdmin, hasMembership }: Props) => {
  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

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
      {/* Incase you also want to scroll NavHeader to scroll with Vertical Menu, remove NavHeader from above and paste it below this comment */}
      {/* Vertical Menu */}
      <Menu
        popoutMenuOffset={{ mainAxis: 10 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {/* Super Admin: show Dashboard + Super Admin menu, hide Create Tenant */}
        {isSuperAdmin ? (
          <>
            <MenuItem href='/home' icon={<i className='ri-home-smile-line' />}>
              Dashboard
            </MenuItem>
            {hasMembership && (
              <SubMenu label='Customers' icon={<i className='ri-user-3-line' />}>
                <MenuItem href='/customers' icon={<i className='ri-list-unordered' />}>
                  List
                </MenuItem>
              </SubMenu>
            )}
            <SubMenu label='Super Admin' icon={<i className='ri-shield-star-line' />}>
              <MenuItem href='/super-admin/subscription-plans' icon={<i className='ri-price-tag-3-line' />}>
                Subscription Plans
              </MenuItem>
            </SubMenu>
            <SubMenu label='Admin' icon={<i className='ri-shield-user-line' />}>
              {tenant?.role && tenant.role !== 'USER' && (
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
          </>
        ) : hasMembership ? (
          <>
            <MenuItem href='/home' icon={<i className='ri-home-smile-line' />}>
              Dashboard
            </MenuItem>

            {hasMembership && (
              <SubMenu label='Customers' icon={<i className='ri-user-3-line' />}>
                <MenuItem href='/customers' icon={<i className='ri-list-unordered' />}>
                  List
                </MenuItem>
              </SubMenu>
            )}

            <SubMenu label='Admin' icon={<i className='ri-shield-user-line' />}>
              {(tenant?.role === 'OWNER' || tenant?.role === 'ADMIN') && (
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
          </>
        ) : (
          <>
            <MenuItem href='/home' icon={<i className='ri-home-smile-line' />}>
              Dashboard
            </MenuItem>
            {/* No customers menu without tenant membership */}
            <SubMenu label='Admin' icon={<i className='ri-shield-user-line' />}>
              <MenuItem href='/create-tenant' icon={<i className='ri-building-2-line' />}>
                Create Organisation
              </MenuItem>
              <MenuItem href='/tenants' icon={<i className='ri-building-4-line' />}>
                Organisation Details
              </MenuItem>
            </SubMenu>
          </>
        )}
      </Menu>
      {/* <Menu
        popoutMenuOffset={{ mainAxis: 10 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        <GenerateVerticalMenu menuData={menuData(dictionary)} />
      </Menu> */}
    </ScrollWrapper>
  )
}

export default VerticalMenu
