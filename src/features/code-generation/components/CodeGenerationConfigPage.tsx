'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import type {
  CodeEntityType,
  CodeGenerationConfig,
  CodeTokenHint
} from '@features/code-generation/code-generation.types'
import {
  getCodeGenerationConfigs,
  previewCodeGeneration,
  reapplyCodeGeneration,
  updateCodeGenerationConfig
} from '@features/code-generation/services/codeGenerationService'

const CodeGenerationConfigPage = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [configs, setConfigs] = useState<CodeGenerationConfig[]>([])
  const [tokens, setTokens] = useState<CodeTokenHint[]>([])
  const [selectedType, setSelectedType] = useState<CodeEntityType>('LEAD')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [reapplying, setReapplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [livePreview, setLivePreview] = useState('')

  const [template, setTemplate] = useState('')
  const [prefix, setPrefix] = useState('')
  const [sequencePadLength, setSequencePadLength] = useState('3')

  const selected = useMemo(
    () => configs.find(c => c.entityType === selectedType) || null,
    [configs, selectedType]
  )

  const relevantTokens = useMemo(() => {
    return tokens.filter(
      t => t.entityTypes === 'ALL' || (Array.isArray(t.entityTypes) && t.entityTypes.includes(selectedType))
    )
  }, [selectedType, tokens])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getCodeGenerationConfigs()

      setConfigs(data.configs)
      setTokens(data.tokens)

      const lead = data.configs.find(c => c.entityType === 'LEAD') || data.configs[0]

      if (lead) {
        setSelectedType(lead.entityType)
        setTemplate(lead.template)
        setPrefix(lead.prefix)
        setSequencePadLength(String(lead.sequencePadLength))
        setLivePreview(lead.samplePreview)
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load code configs')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) return

    setTemplate(selected.template)
    setPrefix(selected.prefix)
    setSequencePadLength(String(selected.sequencePadLength))
    setLivePreview(selected.samplePreview)
  }, [selected])

  const handleSelect = (entityType: CodeEntityType) => {
    setSelectedType(entityType)
    setError(null)
  }

  const handlePreview = async () => {
    setPreviewing(true)
    setError(null)

    try {
      const preview = await previewCodeGeneration({
        entityType: selectedType,
        template,
        prefix,
        sequencePadLength: Number(sequencePadLength)
      })

      setLivePreview(preview)
    } catch (e: any) {
      setError(e?.message || 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      const data = await updateCodeGenerationConfig({
        entityType: selectedType,
        template: template.trim(),
        prefix: prefix.trim().toUpperCase(),
        sequencePadLength: Number(sequencePadLength)
      })

      setConfigs(data.configs)
      setTokens(data.tokens)
      setSuccessMsg('Code configuration saved')

      const updated = data.configs.find(c => c.entityType === selectedType)

      if (updated) setLivePreview(updated.samplePreview)
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleReapply = async (onlyMissing: boolean) => {
    if (!selected?.isWired) return

    const entityLabel = selected.label.toLowerCase()
    const confirmMsg = onlyMissing
      ? selected.entityType === 'LEAD'
        ? 'Generate missing lead codes and repair bank links where a bank can be matched safely?'
        : `Generate codes for ${entityLabel} records that do not have a code yet?`
      : selected.entityType === 'BANK'
        ? 'Regenerate all bank codes from the current template? Linked leads will be updated when matched by bank id, bank code, or bank name.'
        : selected.entityType === 'ASSOCIATE'
          ? 'Regenerate all associate codes from the current template? Existing associate codes will be replaced.'
          : selected.entityType === 'CUSTOMER'
            ? 'Regenerate all customer codes from the current template? Existing customer codes will be replaced.'
            : selected.entityType === 'CORPORATE'
              ? 'Regenerate all corporate codes from the current template? Existing corporate codes will be replaced.'
              : selected.entityType === 'LOAN_TYPE'
                ? 'Regenerate all loan type codes from the current template? Existing loan type codes will be replaced.'
                : selected.entityType === 'ADVOCATE'
                  ? 'Regenerate all advocate codes from the current template? Existing advocate codes will be replaced.'
                  : 'Regenerate all lead codes and repair bank links? Leads are matched to banks by existing bank code, bank name, or legacy name field. Old lead codes are kept as codePrevious.'

    if (!window.confirm(confirmMsg)) return

    setReapplying(true)
    setError(null)

    try {
      const result = await reapplyCodeGeneration({
        entityType: selectedType,
        onlyMissing,
        limit: 200
      })

      setSuccessMsg(
        `Reapply done: ${result.updated} updated, ${result.skipped} skipped, ${result.failed} failed${
          result.banksRepaired ? `, ${result.banksRepaired} bank links repaired` : ''
        } (scanned ${result.scanned})`
      )
    } catch (e: any) {
      setError(e?.message || 'Reapply failed')
    } finally {
      setReapplying(false)
    }
  }

  const insertToken = (token: string) => {
    setTemplate(prev => {
      if (!prev) return token
      if (prev.endsWith('-') || prev.endsWith('{')) return `${prev}${token}`

      return `${prev}-${token}`
    })
  }

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
      <Box>
        <Typography variant='h5'>Code generation</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
          Configure human-readable business codes for leads and masters. One place controls every entity type.
        </Typography>
      </Box>

      {error ? (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Typography variant='body2' color='text.secondary'>
          Loading...
        </Typography>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant='outlined' sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {configs.map(cfg => (
                  <Box
                    key={cfg.entityType}
                    onClick={() => handleSelect(cfg.entityType)}
                    sx={{
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      bgcolor: selectedType === cfg.entityType ? 'action.selected' : 'transparent',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                        {cfg.label}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {cfg.isWired ? (
                          <Chip size='small' label='Live' color='primary' variant='outlined' />
                        ) : (
                          <Chip size='small' label='Soon' variant='outlined' />
                        )}
                      </Box>
                    </Box>
                    <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.25 }}>
                      {cfg.samplePreview}
                    </Typography>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 8 }}>
            {selected ? (
              <Card variant='outlined' sx={{ borderRadius: 3 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant='h6'>{selected.label} code</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {selected.description}
                    </Typography>
                  </Box>

                  {!selected.isWired ? (
                    <Alert severity='info'>
                      Template can be saved now. Create/update wiring for this master will be enabled in a later phase.
                    </Alert>
                  ) : null}

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label='Prefix'
                        value={prefix}
                        onChange={e => setPrefix(e.target.value.toUpperCase().slice(0, 8))}
                        fullWidth
                        size='small'
                        helperText='Used by {PREFIX}'
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label='Default SEQ pad'
                        value={sequencePadLength}
                        onChange={e => setSequencePadLength(e.target.value.replace(/\D/g, '').slice(0, 1))}
                        fullWidth
                        size='small'
                        helperText='For bare {SEQ}'
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label='Template'
                        value={template}
                        onChange={e => setTemplate(e.target.value)}
                        fullWidth
                        size='small'
                        helperText='Leave blank to use {PREFIX}-{SEQ:n} with prefix and pad below'
                      />
                    </Grid>
                  </Grid>

                  <Box>
                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                      Insert token
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {relevantTokens.map(t => (
                        <Chip
                          key={t.token}
                          label={t.token}
                          size='small'
                          onClick={() => insertToken(t.token)}
                          variant='outlined'
                          sx={{ fontFamily: 'monospace' }}
                        />
                      ))}
                    </Box>
                  </Box>

                  <Box
                    sx={{
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'divider',
                      px: 2,
                      py: 1.5,
                      bgcolor: 'action.hover'
                    }}
                  >
                    <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                      Preview
                    </Typography>
                    <Typography variant='h6' sx={{ fontFamily: 'monospace', letterSpacing: 0.5, mt: 0.5 }}>
                      {livePreview || '—'}
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      gap: 1.5,
                      flexWrap: 'wrap'
                    }}
                  >
                    <Button variant='outlined' onClick={() => void handlePreview()} disabled={previewing || saving}>
                      {previewing ? 'Previewing...' : 'Refresh preview'}
                    </Button>
                    <Button variant='contained' onClick={() => void handleSave()} disabled={saving || previewing}>
                      {saving ? 'Saving...' : 'Save configuration'}
                    </Button>
                  </Box>

                  {selected.isWired ? (
                    <>
                      <Divider />
                      <Box>
                        <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                          Update existing {selected.label.toLowerCase()} records
                        </Typography>
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5, mb: 1.5 }}>
                          {selected.entityType === 'BANK'
                            ? 'Regenerate bank codes from the current template. Linked leads are updated when matched by bank id, stored bank code, or bank name (including legacy name fields).'
                            : selected.entityType === 'ASSOCIATE'
                              ? 'Regenerate associate codes from the current template. Use {COMPANY_NAME} and {INITIALS} tokens for company and associate name parts.'
                              : selected.entityType === 'CUSTOMER'
                                ? 'Regenerate customer codes from the current template. Use {CUSTOMER_INITIALS} or {INITIALS} for name-based parts.'
                                : selected.entityType === 'CORPORATE'
                                  ? 'Regenerate corporate codes from the current template. Use {INITIALS} for name-based parts.'
                                  : selected.entityType === 'LOAN_TYPE'
                                    ? 'Regenerate loan type codes from the current template. Use {LOAN_TYPE} or {INITIALS} for name-based parts (used in lead templates).'
                                    : selected.entityType === 'ADVOCATE'
                                      ? 'Regenerate advocate codes from the current template. Use {INITIALS} for name-based parts.'
                                      : 'Regenerate lead codes and repair bank links. Leads are matched to banks by bank id, bank code, bank name, or a legacy name value that matches a bank code. Previous lead codes are kept in codePrevious.'}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
                          <Button
                            variant='outlined'
                            color='primary'
                            disabled={reapplying}
                            fullWidth={isMobile}
                            onClick={() => void handleReapply(true)}
                          >
                            Fill missing codes
                          </Button>
                          <Button
                            variant='outlined'
                            color='warning'
                            disabled={reapplying}
                            fullWidth={isMobile}
                            onClick={() => void handleReapply(false)}
                          >
                            Regenerate all (batch)
                          </Button>
                        </Box>
                      </Box>
                    </>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </Grid>
        </Grid>
      )}

      <Snackbar open={Boolean(successMsg)} autoHideDuration={4000} onClose={() => setSuccessMsg(null)}>
        <Alert severity='success' onClose={() => setSuccessMsg(null)} sx={{ width: '100%' }}>
          {successMsg}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default CodeGenerationConfigPage
