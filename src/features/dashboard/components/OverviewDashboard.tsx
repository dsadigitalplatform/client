'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import { useTheme } from '@mui/material/styles'

import { Responsive, noCompactor, useContainerWidth } from 'react-grid-layout'
import type { Layout, LayoutItem, ResponsiveLayouts } from 'react-grid-layout'

import { useDashboardOverview } from '@features/dashboard/hooks/useDashboardOverview'
import { useDashboardLayout } from '@features/dashboard/hooks/useDashboardLayout'
import type { DashboardWidgetId, TrendPoint } from '@features/dashboard/dashboard.types'

type Props = {
  hasTenantSelected: boolean
  tenantRole?: 'OWNER' | 'ADMIN' | 'USER'
}

type WidgetMeta = {
  id: DashboardWidgetId
  title: string
  icon: string
}

function formatINR(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0

  return `₹ ${safe.toLocaleString('en-IN')}`
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  if (v < 0) return 0
  if (v > 1) return 1

  return v
}

const COLS_BY_BP = { lg: 12, md: 12, sm: 2, xs: 1 } as const

type Breakpoint = keyof typeof COLS_BY_BP
type DashboardLayouts = ResponsiveLayouts<Breakpoint>

const ALL_WIDGET_IDS: DashboardWidgetId[] = [
  'kpi-customers',
  'kpi-cases',
  'kpi-loan-volume',
  'kpi-conversion',
  'trend-cases',
  'trend-loan-volume',
  'stage-breakdown',
  'agents',
  'appointments'
]

const ADMIN_ONLY_WIDGET_IDS = new Set<DashboardWidgetId>(['agents'])

function widgetIdFromUnknown(v: unknown): DashboardWidgetId | null {
  const id = typeof v === 'string' ? (v as DashboardWidgetId) : null

  if (!id) return null
  if (!ALL_WIDGET_IDS.includes(id)) return null

  return id
}

function defaultGridItem(id: DashboardWidgetId, bp: Breakpoint): LayoutItem {
  const cols = COLS_BY_BP[bp]

  if (bp === 'xs') {
    return { i: id, x: 0, y: 0, w: 1, h: id.startsWith('kpi-') ? 2 : 5, minW: 1, minH: id.startsWith('kpi-') ? 2 : 4 }
  }

  if (bp === 'sm') {
    return {
      i: id,
      x: 0,
      y: 0,
      w: id.startsWith('kpi-') ? 1 : 2,
      h: id.startsWith('kpi-') ? 2 : 5,
      minW: id.startsWith('kpi-') ? 1 : 2,
      minH: id.startsWith('kpi-') ? 2 : 4
    }
  }

  if (id.startsWith('kpi-')) {
    return { i: id, x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2, maxW: Math.min(cols, 6) }
  }

  if (id === 'trend-cases' || id === 'trend-loan-volume' || id === 'stage-breakdown' || id === 'agents' || id === 'appointments') {
    return { i: id, x: 0, y: 0, w: bp === 'md' ? 6 : 4, h: 5, minW: bp === 'md' ? 6 : 3, minH: 4 }
  }

  return { i: id, x: 0, y: 0, w: bp === 'md' ? 6 : 4, h: 5, minW: 2, minH: 4 }
}

function buildDefaultLayouts(order: DashboardWidgetId[]): DashboardLayouts {
  const layouts: Record<Breakpoint, LayoutItem[]> = { lg: [], md: [], sm: [], xs: [] }

    ; (Object.keys(COLS_BY_BP) as Breakpoint[]).forEach(bp => {
      const cols = COLS_BY_BP[bp]
      let cursorX = 0
      let cursorY = 0
      let rowH = 0

      order.forEach(id => {
        const base = defaultGridItem(id, bp)

        if (cursorX + base.w > cols) {
          cursorX = 0
          cursorY += rowH
          rowH = 0
        }

        layouts[bp].push({ ...base, x: cursorX, y: cursorY })
        cursorX += base.w
        rowH = Math.max(rowH, base.h)

        if (cursorX >= cols) {
          cursorX = 0
          cursorY += rowH
          rowH = 0
        }
      })
    })

  return layouts as DashboardLayouts
}

function normalizeLayoutsForView(
  input: DashboardLayouts | null | undefined,
  fallback: DashboardLayouts,
  canEdit: boolean
): DashboardLayouts {
  const out: Record<Breakpoint, LayoutItem[]> = {
    lg: Array.from(fallback.lg || []),
    md: Array.from(fallback.md || []),
    sm: Array.from(fallback.sm || []),
    xs: Array.from(fallback.xs || [])
  }

  if (!input) return out as DashboardLayouts

    ; (Object.keys(COLS_BY_BP) as Breakpoint[]).forEach(bp => {
      const arr = input[bp]

      if (!Array.isArray(arr)) return
      if (arr.length === 0 && Array.isArray(fallback[bp]) && fallback[bp]!.length > 0) return

      const seen = new Set<string>()

      const next = Array.from(arr).filter(it => {
        const id = String(it.i || '') as DashboardWidgetId

        if (!id) return false
        if (!ALL_WIDGET_IDS.includes(id)) return false
        if (!canEdit && ADMIN_ONLY_WIDGET_IDS.has(id)) return false
        if (seen.has(id)) return false

        seen.add(id)

        return true
      })

      out[bp] = next
    })

  return out as DashboardLayouts
}

function sanitizeLayoutsForSave(layouts: DashboardLayouts, fallback: DashboardLayouts, canEdit: boolean): DashboardLayouts {
  const desired = new Set<DashboardWidgetId>()

    ; (Object.keys(COLS_BY_BP) as Breakpoint[]).forEach(bp => {
      const arr = layouts[bp]

      if (!Array.isArray(arr)) return

      arr.forEach(it => {
        const id = widgetIdFromUnknown((it as any)?.i)

        if (!id) return
        if (!canEdit && ADMIN_ONLY_WIDGET_IDS.has(id)) return

        desired.add(id)
      })
    })

  if (desired.size === 0) {
    ; (Object.keys(COLS_BY_BP) as Breakpoint[]).forEach(bp => {
      const arr = fallback[bp]

      if (!Array.isArray(arr)) return

      arr.forEach(it => {
        const id = widgetIdFromUnknown((it as any)?.i)

        if (!id) return
        if (!canEdit && ADMIN_ONLY_WIDGET_IDS.has(id)) return

        desired.add(id)
      })
    })
  }

  const desiredIds = Array.from(desired)

  const out: Partial<Record<Breakpoint, LayoutItem[]>> = {}

    ; (Object.keys(COLS_BY_BP) as Breakpoint[]).forEach(bp => {
      const existing = Array.isArray(layouts[bp]) ? Array.from(layouts[bp]!) : []
      const existingById = new Map<DashboardWidgetId, LayoutItem>()

      existing.forEach(it => {
        const id = widgetIdFromUnknown((it as any)?.i)

        if (!id) return
        if (!canEdit && ADMIN_ONLY_WIDGET_IDS.has(id)) return

        existingById.set(id, it)
      })

      const base = Array.isArray(fallback[bp]) ? Array.from(fallback[bp]!) : []
      const baseById = new Map<DashboardWidgetId, LayoutItem>()

      base.forEach(it => {
        const id = widgetIdFromUnknown((it as any)?.i)

        if (!id) return
        if (!canEdit && ADMIN_ONLY_WIDGET_IDS.has(id)) return

        baseById.set(id, it)
      })

      const arr: LayoutItem[] = []
      const seen = new Set<string>()

      desiredIds.forEach(id => {
        const item = existingById.get(id) ?? baseById.get(id)

        if (!item) return
        if (seen.has(id)) return

        seen.add(id)
        arr.push(item)
      })

      out[bp] = arr
    })

  return normalizeLayoutsForView(out as DashboardLayouts, fallback, canEdit)
}

function Sparkline({ points, color }: { points: TrendPoint[]; color: string }) {
  const values = points.map(p => Number(p.value || 0))

  if (values.length < 2) {
    return (
      <svg viewBox='0 0 100 32' width='100%' height='32' aria-hidden='true' preserveAspectRatio='none'>
        <polyline points='2,30 98,30' fill='none' stroke={color} strokeWidth='2' opacity='0.25' />
      </svg>
    )
  }

  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const range = Math.max(1, max - min)
  const w = 100
  const h = 32
  const pad = 2

  const coords = values.map((v, idx) => {
    const x = pad + (idx * (w - pad * 2)) / Math.max(1, values.length - 1)
    const y = pad + ((max - v) * (h - pad * 2)) / range

    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const polyline = coords.join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width='100%' height='32' aria-hidden='true' preserveAspectRatio='none'>
      <polyline
        points={polyline}
        fill='none'
        stroke={color}
        strokeWidth='2'
        strokeLinejoin='round'
        strokeLinecap='round'
        opacity='0.95'
      />
      <polyline
        points={`${coords[0]} ${polyline} ${coords[coords.length - 1]} ${w - pad},${h - pad} ${pad},${h - pad}`}
        fill={color}
        opacity='0.08'
      />
    </svg>
  )
}

function WidgetCard({
  title,
  icon,
  actions,
  children
}: {
  title: string
  icon: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: 2,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 2.25, height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
            <Avatar
              variant='rounded'
              sx={{
                width: 40,
                height: 40,
                borderRadius: 3,
                backgroundColor: 'action.hover',
                color: 'text.primary'
              }}
            >
              <i className={icon} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='subtitle1' sx={{ fontWeight: 800 }} noWrap title={title}>
                {title}
              </Typography>
            </Box>
          </Box>
          {actions ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>{actions}</Box> : null}
        </Box>
        {children}
      </CardContent>
    </Card>
  )
}

function GridWidgetShell({
  title,
  icon,
  editMode,
  onRemove,
  children
}: {
  title: string
  icon: string
  editMode: boolean
  onRemove?: () => void
  children: ReactNode
}) {
  return (
    <Box sx={{ height: '100%' }}>
      <WidgetCard
        title={title}
        icon={icon}
        actions={
          editMode ? (
            <>
              <Tooltip title='Drag'>
                <IconButton
                  size='small'
                  aria-label='drag'
                  className='dashboard-widget-drag-handle'
                  sx={{
                    cursor: 'grab',
                    backgroundColor: 'action.hover',
                    '&:hover': { backgroundColor: 'action.selected' }
                  }}
                >
                  <i className='ri-drag-move-2-line' />
                </IconButton>
              </Tooltip>
              {onRemove ? (
                <Tooltip title='Remove'>
                  <IconButton
                    size='small'
                    aria-label='remove'
                    onClick={onRemove}
                    sx={{
                      backgroundColor: 'action.hover',
                      '&:hover': { backgroundColor: 'action.selected' }
                    }}
                  >
                    <i className='ri-close-line' />
                  </IconButton>
                </Tooltip>
              ) : null}
            </>
          ) : null
        }
      >
        {children}
      </WidgetCard>
    </Box>
  )
}

const ALL_WIDGETS: WidgetMeta[] = [
  { id: 'kpi-customers', title: 'Customers', icon: 'ri-user-3-line' },
  { id: 'kpi-cases', title: 'Cases', icon: 'ri-briefcase-4-line' },
  { id: 'kpi-loan-volume', title: 'Requested Loan Volume', icon: 'ri-money-rupee-circle-line' },
  { id: 'kpi-conversion', title: 'Conversion', icon: 'ri-line-chart-line' },
  { id: 'trend-cases', title: 'Case Trend', icon: 'ri-rhythm-line' },
  { id: 'trend-loan-volume', title: 'Loan Volume Trend', icon: 'ri-funds-line' },
  { id: 'stage-breakdown', title: 'Case Stages', icon: 'ri-git-merge-line' },
  { id: 'agents', title: 'Sales Agents', icon: 'ri-team-line' },
  { id: 'appointments', title: 'Appointments', icon: 'ri-calendar-event-line' }
]

export default function OverviewDashboard({ hasTenantSelected, tenantRole }: Props) {
  const theme = useTheme()
  const canEdit = tenantRole === 'ADMIN' || tenantRole === 'OWNER'
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true })

  const { data, loading, error, refresh } = useDashboardOverview(hasTenantSelected)

  const {
    layout: savedLayout,
    loading: layoutLoading,
    saving: layoutSaving,
    error: layoutError,
    save: saveLayout
  } = useDashboardLayout(hasTenantSelected)

  const defaultLayouts = useMemo(() => {
    const base = canEdit ? ALL_WIDGET_IDS : ALL_WIDGET_IDS.filter(id => id !== 'agents')

    return buildDefaultLayouts(base)
  }, [canEdit])

  const [layouts, setLayouts] = useState<DashboardLayouts>(defaultLayouts)
  const [editMode, setEditMode] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasTenantSelected) return
    if (editMode) return
    if (!savedLayout) return
    const hasAny = Object.values(savedLayout).some(v => Array.isArray(v) && v.length > 0)

    if (!hasAny) return

    setLayouts(normalizeLayoutsForView(savedLayout as any, defaultLayouts, canEdit))
  }, [savedLayout, hasTenantSelected, editMode, defaultLayouts, canEdit])

  useEffect(() => {
    if (canEdit) return
    setLayouts(prev => normalizeLayoutsForView(prev, defaultLayouts, canEdit))
  }, [canEdit, defaultLayouts])

  const widgetById = useMemo(() => new Map(ALL_WIDGETS.map(w => [w.id, w])), [])

  const visibleWidgets = useMemo(() => {
    const allowed = new Set<DashboardWidgetId>()

      ; (Object.keys(COLS_BY_BP) as Breakpoint[]).forEach(bp => {
        const arr = layouts[bp]

        if (!Array.isArray(arr)) return

        arr.forEach(it => {
          const id = String(it?.i || '') as DashboardWidgetId

          if (!id) return
          if (!ALL_WIDGET_IDS.includes(id)) return
          if (id === 'agents' && !canEdit) return

          allowed.add(id)
        })
      })

    if (allowed.size === 0) {
      const base = canEdit ? ALL_WIDGET_IDS : ALL_WIDGET_IDS.filter(id => id !== 'agents')

      base.forEach(id => allowed.add(id))
    }

    return Array.from(allowed)
  }, [layouts, canEdit])

  const hiddenWidgets = useMemo(() => {
    const visible = new Set(visibleWidgets)

    return ALL_WIDGETS.map(w => w.id).filter(id => !visible.has(id) && (canEdit || id !== 'agents'))
  }, [visibleWidgets, canEdit])

  const totals = useMemo(() => {
    const totalCases = data?.loanCases?.total ?? 0
    const totalStages = Array.isArray(data?.loanCases?.byStage) ? data!.loanCases.byStage : []
    const finalStageCount = totalStages.length > 0 ? totalStages[totalStages.length - 1].count : 0
    const conversion = totalCases > 0 ? finalStageCount / totalCases : 0

    return { totalCases, finalStageCount, conversion }
  }, [data])

  const onGridLayoutChange = useCallback(
    (_current: Layout, all: DashboardLayouts) => {
      if (!editMode) return
      setLayouts(prev => {
        const next = normalizeLayoutsForView(all, prev, canEdit)
        const totalItems = Object.values(next).reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0)

        return totalItems === 0 ? prev : next
      })
    },
    [editMode, canEdit]
  )

  const removeWidget = useCallback((id: DashboardWidgetId) => {
    setLayouts(prev => {
      const next: Partial<Record<Breakpoint, LayoutItem[]>> = {}
      const bps = Object.keys(COLS_BY_BP) as Breakpoint[]

      bps.forEach(bp => {
        const arr = Array.from(prev[bp] || [])

        next[bp] = arr.filter(x => String(x.i || '') !== id)
      })

      const count = Object.values(next).reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0)

      return count === 0 ? prev : (next as DashboardLayouts)
    })
  }, [])

  const addWidget = useCallback(
    (id: DashboardWidgetId) => {
      if (!canEdit && id === 'agents') return

      setLayouts(prev => {
        const has = Object.values(prev).some(v => Array.isArray(v) && v.some(x => String(x.i || '') === id))

        if (has) return prev

        const next: Partial<Record<Breakpoint, LayoutItem[]>> = {}
        const bps = Object.keys(COLS_BY_BP) as Breakpoint[]

        bps.forEach(bp => {
          const arr = Array.from(prev[bp] || [])
          const maxY = arr.reduce((m, it) => Math.max(m, Number(it.y || 0) + Number(it.h || 0)), 0)
          const base = defaultGridItem(id, bp)

          next[bp] = [...arr, { ...base, x: 0, y: maxY }]
        })

        return normalizeLayoutsForView(next as DashboardLayouts, defaultLayouts, canEdit)
      })
    },
    [canEdit, defaultLayouts]
  )

  const resetLayout = useCallback(() => {
    setLayouts(defaultLayouts)
  }, [defaultLayouts])

  const publish = useCallback(async () => {
    if (!canEdit) return
    if (layoutSaving) return

    setPublishError(null)

    try {
      const sanitized = sanitizeLayoutsForSave(layouts, defaultLayouts, canEdit)
      const res = await saveLayout(sanitized as any)

      if (res) {
        setLayouts(sanitizeLayoutsForSave(res as any, defaultLayouts, canEdit))
        setEditMode(false)

        return
      }

      setPublishError('Failed to publish')
    } catch (e: any) {
      setPublishError(e?.message || 'Failed to publish')
    }
  }, [canEdit, layoutSaving, layouts, defaultLayouts, saveLayout])

  const renderWidgetBody = useCallback(
    (id: DashboardWidgetId) => {
      if (!data) {
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant='body2' color='text.secondary'>
              {loading ? 'Loading…' : 'No data'}
            </Typography>
            {error ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant='body2' color='error.main' sx={{ fontWeight: 600 }}>
                  {error}
                </Typography>
                <Button size='small' variant='outlined' onClick={refresh}>
                  Retry
                </Button>
              </Box>
            ) : null}
          </Box>
        )
      }

      if (id === 'kpi-customers') {
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant='h4' sx={{ fontWeight: 900 }}>
                {data.customers.total.toLocaleString()}
              </Typography>
              <Chip label='12-week trend' size='small' variant='outlined' />
            </Box>
            <Sparkline points={data.customers.trend} color={theme.palette.primary.main} />
          </Box>
        )
      }

      if (id === 'kpi-cases') {
        const points = data.loanCases.trend.map(p => ({ label: p.label, value: p.count }))


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant='h4' sx={{ fontWeight: 900 }}>
                {data.loanCases.total.toLocaleString()}
              </Typography>
              <Chip label='12-week trend' size='small' variant='outlined' />
            </Box>
            <Sparkline points={points} color={theme.palette.info.main} />
          </Box>
        )
      }

      if (id === 'kpi-loan-volume') {
        const points = data.loanCases.trend.map(p => ({ label: p.label, value: p.requestedLoanVolume }))


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant='h6' sx={{ fontWeight: 900 }}>
                {formatINR(data.loanCases.requestedLoanVolume)}
              </Typography>
              <Chip label='12-week trend' size='small' variant='outlined' />
            </Box>
            <Sparkline points={points} color={theme.palette.success.main} />
          </Box>
        )
      }

      if (id === 'kpi-conversion') {
        const pct = Math.round(clamp01(totals.conversion) * 100)


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant='h4' sx={{ fontWeight: 900 }}>
                {pct}%
              </Typography>
              <Chip label={`Final stage: ${totals.finalStageCount}`} size='small' variant='outlined' />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <LinearProgress
                value={pct}
                variant='determinate'
                sx={{
                  flex: 1,
                  height: 8,
                  borderRadius: 6,
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 6 }
                }}
              />
              <Typography variant='body2' color='text.secondary' sx={{ minWidth: 64, textAlign: 'right' }}>
                {totals.totalCases} total
              </Typography>
            </Box>
          </Box>
        )
      }

      if (id === 'trend-cases') {
        const points = data.loanCases.trend.map(p => ({ label: p.label, value: p.count }))
        const last = data.loanCases.trend[data.loanCases.trend.length - 1]


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant='body2' color='text.secondary'>
              New cases created per week
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant='h6' sx={{ fontWeight: 900 }}>
                {last?.count?.toLocaleString?.() || 0}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Latest week
              </Typography>
            </Box>
            <Sparkline points={points} color={theme.palette.info.main} />
          </Box>
        )
      }

      if (id === 'trend-loan-volume') {
        const points = data.loanCases.trend.map(p => ({ label: p.label, value: p.requestedLoanVolume }))
        const last = data.loanCases.trend[data.loanCases.trend.length - 1]


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant='body2' color='text.secondary'>
              Requested loan volume per week
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography variant='h6' sx={{ fontWeight: 900 }}>
                {formatINR(Number(last?.requestedLoanVolume || 0))}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Latest week
              </Typography>
            </Box>
            <Sparkline points={points} color={theme.palette.success.main} />
          </Box>
        )
      }

      if (id === 'stage-breakdown') {
        const total = Math.max(1, data.loanCases.total)
        const stages = data.loanCases.byStage


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {stages.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No cases found.
              </Typography>
            ) : (
              stages.slice(0, 8).map(s => {
                const pct = Math.round(clamp01(s.count / total) * 100)


                return (
                  <Box key={s.stageName} sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant='body2' sx={{ fontWeight: 700 }} noWrap title={s.stageName}>
                        {s.stageName}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {s.count.toLocaleString()} ({pct}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      value={pct}
                      variant='determinate'
                      sx={{
                        height: 8,
                        borderRadius: 6,
                        backgroundColor: 'action.hover',
                        '& .MuiLinearProgress-bar': { borderRadius: 6 }
                      }}
                    />
                  </Box>
                )
              })
            )}
            {stages.length > 8 ? (
              <Typography variant='body2' color='text.secondary'>
                +{stages.length - 8} more stages
              </Typography>
            ) : null}
          </Box>
        )
      }

      if (id === 'agents') {
        const rows = data.agents?.top || []


        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography variant='body2' color='text.secondary'>
              Top agents by total cases
            </Typography>
            <Divider />
            {rows.length === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No agent assignments yet.
              </Typography>
            ) : (
              rows.slice(0, 6).map(r => (
                <Box
                  key={r.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant='body2' sx={{ fontWeight: 800 }} noWrap title={r.name || r.email || ''}>
                      {r.name || r.email || 'Unknown'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary' noWrap>
                      {r.email || ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip size='small' variant='outlined' label={`${r.totalCases} cases`} />
                    <Chip
                      size='small'
                      variant='outlined'
                      color='success'
                      label={formatINR(r.requestedLoanVolume)}
                      sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                    />
                  </Box>
                </Box>
              ))
            )}
          </Box>
        )
      }

      if (id === 'appointments') {
        const upcoming = [
          { id: 'a1', title: 'Call with Customer', time: 'Today | 18:00-18:30', tag: 'New lead', color: 'primary' as const },
          { id: 'a2', title: 'Document collection', time: 'Tomorrow | 11:00-11:30', tag: 'Documents', color: 'warning' as const },
          { id: 'a3', title: 'Bank follow-up', time: 'Fri | 15:00-15:45', tag: 'Pipeline', color: 'info' as const }
        ]

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Typography variant='body2' color='text.secondary'>
              Upcoming customer appointments (placeholder)
            </Typography>
            <Divider />
            {upcoming.map(a => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant='body2' sx={{ fontWeight: 800 }} noWrap title={a.title}>
                    {a.title}
                  </Typography>
                  <Typography variant='caption' color='text.secondary' noWrap>
                    <i className='ri-time-line' style={{ marginRight: 6 }} />
                    {a.time}
                  </Typography>
                </Box>
                <Chip size='small' label={a.tag} color={a.color} variant='outlined' />
              </Box>
            ))}
            <Typography variant='caption' color='text.secondary'>
              This widget is ready to connect to real appointment data when available.
            </Typography>
          </Box>
        )
      }

      return (
        <Typography variant='body2' color='text.secondary'>
          Unknown widget
        </Typography>
      )
    },
    [data, loading, error, refresh, theme.palette.primary.main, theme.palette.info.main, theme.palette.success.main, totals]
  )

  const header = (
    <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexWrap: 'wrap' }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant='h5' sx={{ fontWeight: 900 }}>
          Overview
        </Typography>
        <Typography variant='body2' color='text.secondary'>
          Key business metrics and pipeline health
        </Typography>
      </Box>
      {canEdit ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
          <Button
            fullWidth
            variant={editMode ? 'contained' : 'outlined'}
            onClick={() => setEditMode(v => !v)}
            startIcon={<i className='ri-layout-masonry-line' />}
          >
            {editMode ? 'Editing' : 'Customize'}
          </Button>
          {editMode ? (
            <>
              <Button fullWidth variant='outlined' onClick={() => setAddOpen(true)} startIcon={<i className='ri-add-line' />}>
                Add
              </Button>
              <Button fullWidth variant='outlined' onClick={resetLayout} startIcon={<i className='ri-restart-line' />}>
                Reset
              </Button>
              <Button
                fullWidth
                variant='contained'
                onClick={publish}
                disabled={layoutSaving || layoutLoading}
                startIcon={<i className='ri-check-line' />}
              >
                Publish
              </Button>
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  )

  if (!hasTenantSelected) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        {header}
        <Card
          variant='outlined'
          sx={{
            borderRadius: 4,
            backgroundColor: 'background.paper'
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant='body1' sx={{ fontWeight: 800 }}>
              Select an organization to view overview metrics
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
              Once a tenant is selected, this dashboard will show customers, loan volume, case stages, and trends.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    )
  }

  const content = (
    <Box ref={containerRef} sx={{ width: '100%' }}>
      {mounted ? (
        <Responsive
          width={width}
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 900, sm: 600, xs: 0 }}
          cols={COLS_BY_BP}
          rowHeight={44}
          margin={[20, 20]}
          containerPadding={[0, 0]}
          compactor={noCompactor}
          dragConfig={{ enabled: editMode, handle: '.dashboard-widget-drag-handle' }}
          resizeConfig={{ enabled: editMode }}
          onLayoutChange={onGridLayoutChange}
        >
          {visibleWidgets.map(id => {
            const meta = widgetById.get(id)

            if (!meta) return null

            const isKpi =
              id === 'kpi-customers' || id === 'kpi-cases' || id === 'kpi-loan-volume' || id === 'kpi-conversion'

            return (
              <Box key={id} sx={{ height: '100%', minHeight: isKpi ? 156 : 260 }}>
                <GridWidgetShell
                  title={meta.title}
                  icon={meta.icon}
                  editMode={editMode}
                  onRemove={editMode ? () => removeWidget(id) : undefined}
                >
                  {renderWidgetBody(id)}
                </GridWidgetShell>
              </Box>
            )
          })}
        </Responsive>
      ) : null}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {header}
      {editMode && (layoutLoading || layoutSaving) ? (
        <Typography variant='body2' color='text.secondary'>
          Saving layout…
        </Typography>
      ) : null}
      {publishError || layoutError ? (
        <Typography variant='body2' color='error.main' sx={{ fontWeight: 700 }}>
          {publishError || layoutError}
        </Typography>
      ) : null}
      {editMode ? (
        <Typography variant='body2' color='text.secondary'>
          Drag widgets using the handle. Resize from the bottom-right corner. Use Remove to hide. Use Add to bring widgets back.
        </Typography>
      ) : null}
      {content}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Add Widgets</DialogTitle>
        <DialogContent dividers>
          {hiddenWidgets.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              All widgets are already on the dashboard.
            </Typography>
          ) : (
            <List disablePadding>
              {hiddenWidgets.map(id => {
                const meta = widgetById.get(id)

                if (!meta) return null

                return (
                  <ListItemButton
                    key={id}
                    onClick={() => {
                      addWidget(id)
                    }}
                    sx={{ borderRadius: 2 }}
                  >
                    <ListItemText
                      primary={meta.title}
                      secondary={id === 'appointments' ? 'Placeholder until appointment integration' : undefined}
                    />
                    <i className='ri-add-line' />
                  </ListItemButton>
                )
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
