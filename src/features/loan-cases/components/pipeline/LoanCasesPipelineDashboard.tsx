'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputAdornment from '@mui/material/InputAdornment'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import Avatar from '@mui/material/Avatar'
import { useTheme } from '@mui/material/styles'

import { DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

import { getLoanCases, updateCaseStage } from '@features/loan-cases/services/loanCasesService'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'

import { PipelineCaseCardOverlay } from './PipelineCaseCard'
import PipelineStageColumn, { type PipelineStage } from './PipelineStageColumn'

type BoardState = {
  stages: PipelineStage[]
  casesById: Record<string, LoanCaseListItem>
  caseIdsByStage: Record<string, string[]>
}

type Filters = {
  assignedAgentId: string
  loanTypeId: string
  stageId: string
  search: string
}

const buildBoardState = (stages: PipelineStage[], cases: LoanCaseListItem[]): BoardState => {
  const casesById: Record<string, LoanCaseListItem> = {}
  const caseIdsByStage: Record<string, string[]> = {}

  stages.forEach(s => {
    caseIdsByStage[s.id] = []
  })

  cases.forEach(c => {
    casesById[c.id] = c

    if (!caseIdsByStage[c.stageId]) caseIdsByStage[c.stageId] = []
    caseIdsByStage[c.stageId].push(c.id)
  })

  return { stages, casesById, caseIdsByStage }
}

const stagePalette = (palette: any) => [
  palette.primary.main,
  palette.info.main,
  palette.success.main,
  palette.warning.main,
  palette.secondary.main,
  palette.error.main
]

const LoanCasesPipelineDashboard = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [board, setBoard] = useState<BoardState>({ stages: [], casesById: {}, caseIdsByStage: {} })
  const [activeCaseId, setActiveCaseId] = useState<string>('')
  const [activeFromStageId, setActiveFromStageId] = useState<string>('')

  const [filters, setFilters] = useState<Filters>({
    assignedAgentId: '',
    loanTypeId: '',
    stageId: '',
    search: ''
  })

  const prevBoardRef = useRef<BoardState | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)

      try {
        const [stagesRaw, casesRaw] = await Promise.all([getLoanStatusPipelineStages(), getLoanCases()])

        const stages = (Array.isArray(stagesRaw) ? stagesRaw : [])
          .map((s: any) => ({
            id: String(s?.id || ''),
            name: String(s?.name || ''),
            order: Number(s?.order || 0)
          }))
          .filter((s: PipelineStage) => s.id.length > 0)
          .sort((a: PipelineStage, b: PipelineStage) => (a.order || 0) - (b.order || 0))

        const cases = (Array.isArray(casesRaw) ? casesRaw : [])
          .map((c: LoanCaseListItem) => c)
          .filter((c: LoanCaseListItem) => c?.id?.length > 0)

        setBoard(buildBoardState(stages, cases))
      } catch (e: any) {
        setError(e?.message || 'Failed to load pipeline')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const stageById = useMemo(() => {
    const map = new Map<string, PipelineStage>()

    board.stages.forEach(s => map.set(s.id, s))

    return map
  }, [board.stages])

  const stageColorById = useMemo(() => {
    const colors = stagePalette(theme.palette)
    const map: Record<string, string> = {}

    board.stages.forEach((s, idx) => {
      map[s.id] = colors[idx % colors.length]
    })

    return map
  }, [board.stages, theme.palette])

  const loanTypeOptions = useMemo(() => {
    const map = new Map<string, string>()

    Object.values(board.casesById).forEach(c => {
      if (!c.loanTypeId) return
      if (map.has(c.loanTypeId)) return
      map.set(c.loanTypeId, c.loanTypeName || 'Loan Type')
    })

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [board.casesById])

  const agentOptions = useMemo(() => {
    const map = new Map<string, string>()

    Object.values(board.casesById).forEach(c => {
      if (!c.assignedAgentId) return
      if (map.has(c.assignedAgentId)) return
      map.set(c.assignedAgentId, c.assignedAgentName || c.assignedAgentEmail || 'Agent')
    })

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [board.casesById])

  const filteredCaseIdsByStage = useMemo(() => {
    const search = filters.search.trim().toLowerCase()
    const onlyStage = filters.stageId.trim()

    const result: Record<string, string[]> = {}

    board.stages.forEach(s => {
      const ids = board.caseIdsByStage[s.id] || []

      if (onlyStage && s.id !== onlyStage) {
        result[s.id] = []

        return
      }

      result[s.id] = ids.filter(caseId => {
        const c = board.casesById[caseId]

        if (!c) return false

        if (filters.assignedAgentId && c.assignedAgentId !== filters.assignedAgentId) return false
        if (filters.loanTypeId && c.loanTypeId !== filters.loanTypeId) return false
        if (search && !(c.customerName || '').toLowerCase().includes(search)) return false

        return true
      })
    })

    return result
  }, [board.caseIdsByStage, board.casesById, board.stages, filters.assignedAgentId, filters.loanTypeId, filters.search, filters.stageId])

  const analytics = useMemo(() => {
    const all = Object.values(board.casesById)

    const totalCases = all.length
    const totalLoanValue = all.reduce((acc, c) => (typeof c.requestedAmount === 'number' ? acc + c.requestedAmount : acc), 0)

    const pendingDocuments = all.reduce(
      (acc, c) => (typeof c.pendingDocumentsCount === 'number' ? acc + c.pendingDocumentsCount : acc),
      0
    )

    const finalStage = board.stages.reduce<PipelineStage | null>((max, s) => {
      if (!max) return s
      if ((s.order || 0) > (max.order || 0)) return s

      return max
    }, null)

    const inFinalStage = finalStage ? (board.caseIdsByStage[finalStage.id] || []).length : 0

    return { totalCases, totalLoanValue, inFinalStage, pendingDocuments }
  }, [board.caseIdsByStage, board.casesById, board.stages])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } })
  )

  const onDragStart = useCallback((evt: any) => {
    const activeId = String(evt?.active?.id || '')
    const fromStageId = String(evt?.active?.data?.current?.stageId || '')

    setActiveCaseId(activeId)
    setActiveFromStageId(fromStageId)
  }, [])

  const onDragEnd = useCallback(
    async (evt: any) => {
      const activeId = String(evt?.active?.id || '')
      const overId = String(evt?.over?.id || '')
      const fromStageId = String(evt?.active?.data?.current?.stageId || '')

      setActiveCaseId('')
      setActiveFromStageId('')

      if (!activeId || !overId || !fromStageId) return
      if (fromStageId === overId) return

      const c = board.casesById[activeId]
      const canMove = Boolean(c?.canMoveStage ?? true)

      if (!c || !canMove) return

      prevBoardRef.current = board

      const nextStage = stageById.get(overId)
      const nextStageName = nextStage?.name || c.stageName

      setBoard(prev => {
        const next: BoardState = {
          stages: prev.stages,
          casesById: { ...prev.casesById },
          caseIdsByStage: { ...prev.caseIdsByStage }
        }

        const from = (next.caseIdsByStage[fromStageId] || []).filter(id => id !== activeId)
        const to = [activeId, ...(next.caseIdsByStage[overId] || []).filter(id => id !== activeId)]

        next.caseIdsByStage[fromStageId] = from
        next.caseIdsByStage[overId] = to
        next.casesById[activeId] = { ...next.casesById[activeId], stageId: overId, stageName: nextStageName }

        return next
      })

      try {
        const res = await updateCaseStage(activeId, overId)

        if (res?.updatedAt) {
          setBoard(prev => ({
            ...prev,
            casesById: {
              ...prev.casesById,
              [activeId]: { ...prev.casesById[activeId], updatedAt: String(res.updatedAt) }
            }
          }))
        }
      } catch (e: any) {
        if (prevBoardRef.current) setBoard(prevBoardRef.current)
        setError(e?.message || 'Failed to update stage')
      } finally {
        prevBoardRef.current = null
      }
    },
    [board, stageById]
  )

  const onDragCancel = useCallback(() => {
    setActiveCaseId('')
    setActiveFromStageId('')
  }, [])

  const headerSection = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5
      }}
    >
      <Typography variant='h5'>Lead & Loan Status Board</Typography>
      <Typography variant='body2' color='text.secondary'>
        Track cases across stages and move them with drag-and-drop
      </Typography>
    </Box>
  )

  const filtersBar = (
    <Card
      variant='outlined'
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.appBar - 1,
        borderRadius: 4,
        backdropFilter: 'blur(6px)',
        backgroundColor: theme.palette.background.paper
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.25}
          sx={{ alignItems: { sm: 'center' } }}
        >
          <TextField
            size='small'
            label='Search'
            placeholder='Customer name'
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            fullWidth={isMobile}
            sx={{ minWidth: { sm: 280 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-search-line' />
                </InputAdornment>
              )
            }}
          />

          <FormControl size='small' fullWidth={isMobile} sx={{ minWidth: { sm: 180 } }}>
            <InputLabel id='loan-case-pipeline-agent'>Agent</InputLabel>
            <Select
              labelId='loan-case-pipeline-agent'
              label='Agent'
              value={filters.assignedAgentId}
              onChange={e => setFilters(f => ({ ...f, assignedAgentId: String(e.target.value) }))}
            >
              <MenuItem value=''>All</MenuItem>
              {agentOptions.map(a => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size='small' fullWidth={isMobile} sx={{ minWidth: { sm: 180 } }}>
            <InputLabel id='loan-case-pipeline-loan-type'>Loan Type</InputLabel>
            <Select
              labelId='loan-case-pipeline-loan-type'
              label='Loan Type'
              value={filters.loanTypeId}
              onChange={e => setFilters(f => ({ ...f, loanTypeId: String(e.target.value) }))}
            >
              <MenuItem value=''>All</MenuItem>
              {loanTypeOptions.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size='small' fullWidth={isMobile} sx={{ minWidth: { sm: 180 } }}>
            <InputLabel id='loan-case-pipeline-stage'>Stage</InputLabel>
            <Select
              labelId='loan-case-pipeline-stage'
              label='Stage'
              value={filters.stageId}
              onChange={e => setFilters(f => ({ ...f, stageId: String(e.target.value) }))}
            >
              <MenuItem value=''>All</MenuItem>
              {board.stages.map(s => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </CardContent>
    </Card>
  )

  const analyticsRow = (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
      <Card sx={{ borderRadius: 4, boxShadow: 2 }}>
        <CardContent sx={{ p: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='body2' color='text.secondary'>
                Total Cases
              </Typography>
              <Typography variant='h6' sx={{ fontWeight: 900, mt: 0.25 }}>
                {analytics.totalCases}
              </Typography>
            </Box>
            <Avatar
              variant='rounded'
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText
              }}
            >
              <i className='ri-briefcase-4-line' />
            </Avatar>
          </Box>
        </CardContent>
      </Card>
      <Card sx={{ borderRadius: 4, boxShadow: 2 }}>
        <CardContent sx={{ p: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='body2' color='text.secondary'>
                Total Loan Value
              </Typography>
              <Typography variant='h6' sx={{ fontWeight: 900, mt: 0.25 }}>
                ₹ {analytics.totalLoanValue.toLocaleString('en-IN')}
              </Typography>
            </Box>
            <Avatar
              variant='rounded'
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                backgroundColor: theme.palette.success.main,
                color: theme.palette.success.contrastText
              }}
            >
              <i className='ri-money-rupee-circle-line' />
            </Avatar>
          </Box>
        </CardContent>
      </Card>
      <Card sx={{ borderRadius: 4, boxShadow: 2 }}>
        <CardContent sx={{ p: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='body2' color='text.secondary'>
                In Final Stage
              </Typography>
              <Typography variant='h6' sx={{ fontWeight: 900, mt: 0.25 }}>
                {analytics.inFinalStage}
              </Typography>
            </Box>
            <Avatar
              variant='rounded'
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                backgroundColor: theme.palette.info.main,
                color: theme.palette.info.contrastText
              }}
            >
              <i className='ri-flag-2-line' />
            </Avatar>
          </Box>
        </CardContent>
      </Card>
      <Card sx={{ borderRadius: 4, boxShadow: 2 }}>
        <CardContent sx={{ p: 2.25 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='body2' color='text.secondary'>
                Pending Documents
              </Typography>
              <Typography variant='h6' sx={{ fontWeight: 900, mt: 0.25 }}>
                {analytics.pendingDocuments}
              </Typography>
            </Box>
            <Avatar
              variant='rounded'
              sx={{
                width: 42,
                height: 42,
                borderRadius: 3,
                backgroundColor: theme.palette.warning.main,
                color: theme.palette.warning.contrastText
              }}
            >
              <i className='ri-file-warning-line' />
            </Avatar>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )

  if (loading) {
    return (
      <Box className='flex flex-col gap-4'>
        {headerSection}
        {filtersBar}
        {analyticsRow}
        <Card variant='outlined' sx={{ borderRadius: 4 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant='body2' color='text.secondary'>
              Loading pipeline…
            </Typography>
          </CardContent>
        </Card>
      </Box>
    )
  }

  if (board.stages.length === 0) {
    return (
      <Box className='flex flex-col gap-4'>
        {headerSection}
        {filtersBar}
        {analyticsRow}
        {error && <Alert severity='error'>{error}</Alert>}
        <Alert severity='info'>No stages found. Create stages in Loan Status Pipeline first.</Alert>
      </Box>
    )
  }

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
      {headerSection}
      {filtersBar}
      {analyticsRow}
      {error && <Alert severity='error'>{error}</Alert>}

      <Divider />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={onDragCancel}>
        {isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {board.stages.map((stage, idx) => (
              <Accordion key={stage.id} defaultExpanded={idx === 0} disableGutters sx={{ borderRadius: 4 }}>
                <AccordionSummary expandIcon={<i className='ri-arrow-down-s-line' />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: stageColorById[stage.id] }} />
                    <Typography sx={{ fontWeight: 900, flex: 1 }}>{stage.name}</Typography>
                    <Chip size='small' label={(filteredCaseIdsByStage[stage.id] || []).length} />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <PipelineStageColumn
                    stage={stage}
                    stageColor={stageColorById[stage.id]}
                    caseIds={filteredCaseIdsByStage[stage.id] || []}
                    casesById={board.casesById}
                  />
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              gap: 2.5,
              overflowX: 'auto',
              pb: 1.75,
              px: 1,
              scrollPaddingInline: 8,
              scrollSnapType: 'x mandatory',
              overscrollBehaviorX: 'contain',
              backgroundColor: theme => theme.palette.background.default,
              borderRadius: 4,
              pt: 1.25,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.35) transparent',
              '&::-webkit-scrollbar': {
                height: 10
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'transparent'
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.3)',
                borderRadius: 999,
                border: '3px solid transparent',
                backgroundClip: 'content-box'
              },
              '&::-webkit-scrollbar-thumb:hover': {
                backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.45)'
              }
            }}
          >
            {board.stages.map(stage => (
              <PipelineStageColumn
                key={stage.id}
                stage={stage}
                stageColor={stageColorById[stage.id]}
                caseIds={filteredCaseIdsByStage[stage.id] || []}
                casesById={board.casesById}
              />
            ))}
          </Box>
        )}

        <DragOverlay zIndex={theme.zIndex.modal + 10}>
          {activeCaseId && board.casesById[activeCaseId] ? (
            <PipelineCaseCardOverlay
              loanCase={board.casesById[activeCaseId]}
              stageColor={stageColorById[activeFromStageId || board.casesById[activeCaseId].stageId] || theme.palette.primary.main}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </Box>
  )
}

export default LoanCasesPipelineDashboard
