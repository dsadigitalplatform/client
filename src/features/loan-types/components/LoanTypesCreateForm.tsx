'use client'

import { useEffect, useState } from 'react'

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

import { createLoanType } from '@features/loan-types/services/loanTypesService'

type Props = {
  onSuccess?: (id?: string) => void
  onCancel?: () => void
  showTitle?: boolean
  submitDisabled?: boolean
  initialValues?: Partial<{
    name: string
    description: string | null
    isActive: boolean
  }>
  onSubmitOverride?: (payload: any) => Promise<void>
  submitLabel?: string
}

const LoanTypesCreateForm = ({ onSuccess, onCancel, showTitle = true, submitDisabled, initialValues, onSubmitOverride, submitLabel }: Props) => {
  const router = useRouter()

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

  return (
    <Card sx={{ borderRadius: 3, boxShadow: 'var(--mui-customShadows-lg, 0px 6px 24px rgba(0,0,0,0.08))' }}>
      {showTitle ? <CardHeader title='Add Loan Type' subheader='Define a loan type and its properties' /> : null}
      <CardContent>
        {error ? <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert> : null}
        <Stack spacing={3}>
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
      <CardActions sx={{ px: 3, pb: 3 }}>
        <Box className='flex gap-3'>
          <Button variant='contained' disabled={submitting || submitDisabled} onClick={handleSubmit}>
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
    </Card>
  )
}

export default LoanTypesCreateForm
