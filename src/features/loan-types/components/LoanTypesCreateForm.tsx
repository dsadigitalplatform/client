'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter } from 'next/navigation'

import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import { createLoanType } from '@features/loan-types/services/loanTypesService'

type Props = {
  onSuccess?: (id?: string) => void
  onCancel?: () => void
  showTitle?: boolean
  variant?: 'card' | 'plain'
  submitDisabled?: boolean
  initialValues?: Partial<{
    name: string
    description: string | null
    isActive: boolean
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
}

const LoanTypesCreateForm = ({
  onSuccess,
  onCancel,
  showTitle = true,
  variant = 'card',
  submitDisabled,
  initialValues,
  onSubmitOverride,
  submitLabel
}: Props) => {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const useCard = variant === 'card'

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!initialValues) return
    if (initialValues.name != null) setName(initialValues.name)
    if (initialValues.description !== undefined) setDescription(initialValues.description || '')
    if (initialValues.isActive != null) setIsActive(Boolean(initialValues.isActive))
  }, [initialValues])

  const validate = () => {
    const next: Record<string, string> = {}

    if (name.trim().length < 2) next.name = 'Name is required'
    setFieldErrors(next)

    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setError(null)

    try {
      let createdId: string | undefined

      const payload = {
        name: name.trim(),
        description: description.trim().length === 0 ? null : description.trim(),
        isActive
      }

      if (onSubmitOverride) {
        await onSubmitOverride(payload)
      } else {
        const res = await createLoanType(payload)

        createdId = res?.id
      }

      if (onSuccess) onSuccess(createdId)
      if (!onSuccess && !onSubmitOverride) router.push('/loan-types')
    } catch (e: any) {
      setError(e?.message || 'Failed to save loan type')
      if (e?.details && typeof e.details === 'object') setFieldErrors(e.details)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = useMemo(() => {
    return name.trim().length >= 2
  }, [name])

  const mobileTitle = submitLabel || (initialValues ? 'Update Loan Type' : 'Add Loan Type')

  return useCard ? (
    <Card
      sx={{
        borderRadius: { xs: 4, sm: 3 },
        boxShadow: isMobile ? 'none' : 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))',
        border: isMobile ? '1px solid' : 'none',
        borderColor: isMobile ? 'divider' : 'transparent'
      }}
    >
      {showTitle && !isMobile ? <CardHeader title='Add Loan Type' subheader='Define a loan type and its properties' /> : null}
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {isMobile ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Button
              variant='text'
              onClick={() => (onCancel ? onCancel() : router.push('/loan-types'))}
              startIcon={<i className='ri-arrow-left-line' />}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Back
            </Button>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              {mobileTitle}
            </Typography>
            <IconButton
              color='primary'
              onClick={handleSubmit}
              disabled={submitting || !!submitDisabled || !canSubmit}
              aria-label='Save loan type'
            >
              <i className='ri-check-line' />
            </IconButton>
          </Box>
        ) : null}
        {isMobile ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <i className='ri-file-list-3-line text-2xl' />
            </Avatar>
          </Box>
        ) : null}
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={isMobile ? 2 : 3}>
          <Typography variant='subtitle2' color='text.secondary'>
            Basic Information
          </Typography>
          <TextField
            label='Name'
            value={name}
            onChange={e => setName(e.target.value)}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-file-list-3-line' />
                </InputAdornment>
              )
            }}
          />
          <TextField
            label='Description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-file-text-line' />
                </InputAdornment>
              )
            }}
          />
          <Divider />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
            label={isActive ? 'Active' : 'Inactive'}
          />
        </Stack>
      </CardContent>
      {!isMobile ? (
        <CardActions sx={{ px: 3, pb: 3 }}>
          <Box className='flex gap-3'>
            <Button variant='contained' disabled={submitting || submitDisabled || !canSubmit} onClick={handleSubmit}>
              {submitting ? 'Saving...' : submitLabel || 'Save Loan Type'}
            </Button>
            <Button
              variant='outlined'
              disabled={submitting}
              onClick={() => (onCancel ? onCancel() : router.push('/loan-types'))}
            >
              Cancel
            </Button>
          </Box>
        </CardActions>
      ) : null}
    </Card>
  ) : (
    <Box>
      <Box sx={{ p: 0 }}>
        {isMobile ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Button
              variant='text'
              onClick={() => (onCancel ? onCancel() : router.push('/loan-types'))}
              startIcon={<i className='ri-arrow-left-line' />}
              sx={{ minWidth: 'auto', px: 1 }}
            >
              Back
            </Button>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              {mobileTitle}
            </Typography>
            <IconButton
              color='primary'
              onClick={handleSubmit}
              disabled={submitting || !!submitDisabled || !canSubmit}
              aria-label='Save loan type'
            >
              <i className='ri-check-line' />
            </IconButton>
          </Box>
        ) : null}
        {isMobile ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar sx={{ width: 72, height: 72, bgcolor: 'action.hover', color: 'text.secondary' }}>
              <i className='ri-file-list-3-line text-2xl' />
            </Avatar>
          </Box>
        ) : null}
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={isMobile ? 2 : 3}>
          <Typography variant='subtitle2' color='text.secondary'>
            Basic Information
          </Typography>
          <TextField
            label='Name'
            value={name}
            onChange={e => setName(e.target.value)}
            error={!!fieldErrors.name}
            helperText={fieldErrors.name}
            fullWidth
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-file-list-3-line' />
                </InputAdornment>
              )
            }}
          />
          <TextField
            label='Description'
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='ri-file-text-line' />
                </InputAdornment>
              )
            }}
          />
          <Divider />
          <FormControlLabel
            control={<Switch checked={isActive} onChange={e => setIsActive(e.target.checked)} />}
            label={isActive ? 'Active' : 'Inactive'}
          />
        </Stack>
      </Box>
    </Box>
  )
}

export default LoanTypesCreateForm
