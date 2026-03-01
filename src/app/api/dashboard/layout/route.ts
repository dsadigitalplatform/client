export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

async function getTenantContext(session: any) {
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String(session?.currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  if (!ObjectId.isValid(currentTenantId)) return { error: NextResponse.json({ error: 'invalid_tenant' }, { status: 400 }) }

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String(session?.user?.email || '')

  const emailFilter =
    email && email.length > 0 ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } } : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    role: String((membership as any).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

const WIDGET_IDS = [
  'kpi-customers',
  'kpi-cases',
  'kpi-loan-volume',
  'kpi-conversion',
  'stage-breakdown',
  'trend-cases',
  'trend-loan-volume',
  'agents',
  'appointments'
] as const

function isWidgetId(v: unknown): v is (typeof WIDGET_IDS)[number] {
  return typeof v === 'string' && (WIDGET_IDS as readonly string[]).includes(v)
}

type Breakpoint = 'lg' | 'md' | 'sm' | 'xs'

type GridItem = {
  i: (typeof WIDGET_IDS)[number]
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}

type GridLayouts = Partial<Record<Breakpoint, GridItem[]>>

const COLS_BY_BP: Record<Breakpoint, number> = { lg: 12, md: 12, sm: 2, xs: 1 }
const ADMIN_ONLY_WIDGETS = new Set<(typeof WIDGET_IDS)[number]>(['agents'])

function normalizeWidgetOrder(input: unknown) {
  if (!Array.isArray(input)) return []
  const out: Array<(typeof WIDGET_IDS)[number]> = []
  const seen = new Set<string>()

  input.forEach(v => {
    if (!isWidgetId(v)) return
    if (seen.has(v)) return
    seen.add(v)
    out.push(v)
  })

  return out
}

function normalizeGridItem(input: any, bp: Breakpoint): GridItem | null {
  const i = input?.i

  if (!isWidgetId(i)) return null
  if (!Number.isFinite(input?.x) || !Number.isFinite(input?.y) || !Number.isFinite(input?.w) || !Number.isFinite(input?.h)) return null

  const cols = COLS_BY_BP[bp]
  const w = Math.max(1, Math.min(cols, Math.floor(Number(input.w))))
  const x = Math.max(0, Math.min(cols - w, Math.floor(Number(input.x))))
  const y = Math.max(0, Math.floor(Number(input.y)))
  const h = Math.max(1, Math.floor(Number(input.h)))

  const item: GridItem = { i, x, y, w, h }

  if (Number.isFinite(input?.minW)) item.minW = Math.max(1, Math.min(cols, Math.floor(Number(input.minW))))
  if (Number.isFinite(input?.minH)) item.minH = Math.max(1, Math.floor(Number(input.minH)))
  if (Number.isFinite(input?.maxW)) item.maxW = Math.max(1, Math.min(cols, Math.floor(Number(input.maxW))))
  if (Number.isFinite(input?.maxH)) item.maxH = Math.max(1, Math.floor(Number(input.maxH)))
  if (typeof input?.static === 'boolean') item.static = input.static

  return item
}

function normalizeLayouts(input: unknown): GridLayouts | null {
  if (!input || typeof input !== 'object') return null

  const obj = input as any

  const out: GridLayouts = {}

  ;(['lg', 'md', 'sm', 'xs'] as const).forEach(bp => {
    if (!Array.isArray(obj[bp])) return
    const seen = new Set<string>()
    const items: GridItem[] = []

    obj[bp].forEach((raw: any) => {
      const item = normalizeGridItem(raw, bp)

      if (!item) return
      if (seen.has(item.i)) return
      seen.add(item.i)
      items.push(item)
    })

    out[bp] = items
  })

  const hasAny = Object.values(out).some(v => Array.isArray(v) && v.length > 0)

  return hasAny ? out : null
}

function removeWidgets(layouts: GridLayouts, ids: Set<(typeof WIDGET_IDS)[number]>): GridLayouts {
  const out: GridLayouts = {}

  ;(['lg', 'md', 'sm', 'xs'] as const).forEach(bp => {
    const arr = layouts[bp]

    if (!Array.isArray(arr)) return
    out[bp] = arr.filter(it => !ids.has(it.i))
  })

  return out
}

function defaultGridItem(id: (typeof WIDGET_IDS)[number], bp: Breakpoint): GridItem {
  const cols = COLS_BY_BP[bp]

  if (bp === 'xs') {
    return { i: id, x: 0, y: 0, w: 1, h: id.startsWith('kpi-') ? 2 : 5, minW: 1, minH: id.startsWith('kpi-') ? 2 : 4 }
  }

  if (bp === 'sm') {
    return { i: id, x: 0, y: 0, w: id.startsWith('kpi-') ? 1 : 2, h: id.startsWith('kpi-') ? 2 : 5, minW: id.startsWith('kpi-') ? 1 : 2, minH: id.startsWith('kpi-') ? 2 : 4 }
  }

  if (id.startsWith('kpi-')) {
    return { i: id, x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: Math.min(cols, 6) }
  }

  if (id === 'trend-cases' || id === 'trend-loan-volume' || id === 'stage-breakdown' || id === 'agents' || id === 'appointments') {
    return { i: id, x: 0, y: 0, w: bp === 'md' ? 6 : 4, h: 5, minW: bp === 'md' ? 6 : 3, minH: 4 }
  }

  return { i: id, x: 0, y: 0, w: bp === 'md' ? 6 : 4, h: 5, minW: 2, minH: 4 }
}

function buildDefaultLayouts(order: Array<(typeof WIDGET_IDS)[number]>): GridLayouts {
  const layouts: GridLayouts = { lg: [], md: [], sm: [], xs: [] }

  ;(['lg', 'md', 'sm', 'xs'] as const).forEach(bp => {
    const cols = COLS_BY_BP[bp]
    let cursorX = 0
    let cursorY = 0
    let rowH = 0

    const push = (item: GridItem) => {
      layouts[bp]!.push(item)
    }

    order.forEach(id => {
      const base = defaultGridItem(id, bp)

      if (cursorX + base.w > cols) {
        cursorX = 0
        cursorY += rowH
        rowH = 0
      }

      push({ ...base, x: cursorX, y: cursorY })
      cursorX += base.w
      rowH = Math.max(rowH, base.h)

      if (cursorX >= cols) {
        cursorX = 0
        cursorY += rowH
        rowH = 0
      }
    })
  })

  return layouts
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, role } = ctx

  const t = await db.collection('tenants').findOne({ _id: tenantIdObj }, { projection: { 'theme.dashboardLayout': 1 } })

  const raw = (t as any)?.theme?.dashboardLayout

  const fallbackOrder = (
    role === 'ADMIN' || role === 'OWNER'
      ? ([
          'kpi-customers',
          'kpi-cases',
          'kpi-loan-volume',
          'kpi-conversion',
          'trend-cases',
          'trend-loan-volume',
          'stage-breakdown',
          'agents',
          'appointments'
        ] as Array<(typeof WIDGET_IDS)[number]>)
      : ([
          'kpi-customers',
          'kpi-cases',
          'kpi-loan-volume',
          'kpi-conversion',
          'trend-cases',
          'trend-loan-volume',
          'stage-breakdown',
          'appointments'
        ] as Array<(typeof WIDGET_IDS)[number]>)
  )

  const order = normalizeWidgetOrder(raw)
  let layouts = normalizeLayouts(raw) ?? buildDefaultLayouts(order.length > 0 ? order : fallbackOrder)

  if (role !== 'ADMIN' && role !== 'OWNER') {
    layouts = removeWidgets(layouts, ADMIN_ONLY_WIDGETS)

    const totalItems = Object.values(layouts).reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0)

    if (totalItems === 0) layouts = buildDefaultLayouts(fallbackOrder)
  }

  return NextResponse.json({ layout: layouts })
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, role } = ctx

  if (role !== 'OWNER' && role !== 'ADMIN') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))

  const layouts =
    normalizeLayouts(body?.layout) ??
    (Array.isArray(body?.layout) ? buildDefaultLayouts(normalizeWidgetOrder(body?.layout)) : null)

  const totalItems = Object.values(layouts || {}).reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0)

  if (!layouts || totalItems === 0) return NextResponse.json({ error: 'invalid_layout' }, { status: 400 })
  if (totalItems > 80) return NextResponse.json({ error: 'invalid_layout' }, { status: 400 })

  await db
    .collection('tenants')
    .updateOne({ _id: tenantIdObj }, { $set: { 'theme.dashboardLayout': layouts, updatedAt: new Date() } })

  return NextResponse.json({ ok: true, layout: layouts })
}
