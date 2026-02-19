'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Alert from '@mui/material/Alert'

import { SubscriptionPlansPicker } from '@features/subscription-plans/components/SubscriptionPlansPicker'

type TenantType = 'sole_trader' | 'company'

// type removed

export const CreateTenantForm = () => {
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [type, setType] = useState<TenantType>('sole_trader')
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [step, setStep] = useState<number>(0)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)

    if (!name.trim()) {
      setError('Please enter a tenant name')

      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, subscriptionPlanId: selectedPlanId || undefined })
      })

      const data: any = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create tenant')
      }

      const tenantId: string | undefined = data?.tenantId

      if (tenantId) {
        const form = new FormData()

        form.append('tenantId', tenantId)

        try {
          await fetch('/api/session/tenant?return=json', { method: 'POST', body: form })
        } catch { }

        router.replace(`/tenants/${tenantId}`)
        
return
      }

      setSuccessMsg('Organisation created successfully')
      router.replace('/tenants')
    } catch (e: any) {
      setError(e.message || 'Unexpected error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box className='flex flex-col gap-4'>
      {successMsg ? <Alert severity='success'>{successMsg}</Alert> : null}

      <Stepper activeStep={step} alternativeLabel>
        <Step key='plan'>
          <StepLabel>Select Plan</StepLabel>
        </Step>
        <Step key='details'>
          <StepLabel>Organisation Details</StepLabel>
        </Step>
      </Stepper>
      {step === 0 ? (
        <>
          <SubscriptionPlansPicker selectedPlanId={selectedPlanId} onSelect={setSelectedPlanId} />
          <Box className='flex items-center gap-2'>
            <Button variant='contained' onClick={() => setStep(1)} disabled={!selectedPlanId}>
              Continue
            </Button>
          </Box>
        </>
      ) : (
        <>
          <TextField label='Organisation Name' value={name} onChange={e => setName(e.target.value)} />
          <FormControl>
            <InputLabel id='tenant-type-label'>Type</InputLabel>
            <Select
              labelId='tenant-type-label'
              label='Type'
              value={type}
              onChange={e => setType(e.target.value as TenantType)}
            >
              <MenuItem value='sole_trader'>Sole Trader</MenuItem>
              <MenuItem value='company'>Company</MenuItem>
            </Select>
          </FormControl>
          {error ? <Typography color='error'>{error}</Typography> : null}
          <Box className='flex items-center gap-2'>
            <Button variant='text' onClick={() => setStep(0)}>Back</Button>
            <Button variant='contained' disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Creating...' : 'Create'}
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}
