// Type Imports
import { cookies } from 'next/headers'

import { ObjectId } from 'mongodb'

import type { ChildrenType, Direction } from '@core/types'

// Context Imports
import { VerticalNavProvider } from '@menu/contexts/verticalNavContext'
import { SettingsProvider } from '@core/contexts/settingsContext'
import ThemeProvider from '@components/theme'
import ClientProviders from '@components/ClientProviders'

// Util Imports
import { getMode, getSettingsFromCookie, getSystemMode } from '@core/utils/serverHelpers'
import { getDb } from '@/lib/mongodb'

type Props = ChildrenType & {
  direction: Direction
  tenantPrimaryColor?: string | null
}

const Providers = async (props: Props) => {
  // Props
  const { children, direction, tenantPrimaryColor } = props

  // Vars
  const mode = await getMode()
  const settingsCookie = await getSettingsFromCookie()
  const systemMode = await getSystemMode()
  const cookieStore = await cookies()

  const currentTenantId = cookieStore.get('CURRENT_TENANT_ID')?.value
  let effectiveSettings = settingsCookie

  if (tenantPrimaryColor && typeof tenantPrimaryColor === 'string') {
    effectiveSettings = { ...effectiveSettings, primaryColor: tenantPrimaryColor }
  }

  if (currentTenantId) {
    let tenantPrimary: string | undefined

    if (ObjectId.isValid(currentTenantId)) {
      try {
        const db = await getDb()

        const doc = await db
          .collection('tenants')
          .findOne({ _id: new ObjectId(currentTenantId) }, { projection: { 'theme.primaryColor': 1 } })

        tenantPrimary = ((doc as any)?.theme?.primaryColor as string | undefined) || undefined
      } catch {
        // ignore DB errors
      }
    }

    if (tenantPrimary && typeof tenantPrimary === 'string') {
      effectiveSettings = { ...settingsCookie, primaryColor: tenantPrimary }
    }
  }

  return (
    <VerticalNavProvider>
      <SettingsProvider settingsCookie={effectiveSettings} mode={mode}>
        <ThemeProvider direction={direction} systemMode={systemMode}>
          <ClientProviders>{children}</ClientProviders>
        </ThemeProvider>
      </SettingsProvider>
    </VerticalNavProvider>
  )
}

export default Providers
