'use client'

import { useMemo, useState } from 'react'

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
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Paper from '@mui/material/Paper'

import { SubscriptionPlansPicker } from '@features/subscription-plans/components/SubscriptionPlansPicker'
import primaryColorConfig from '@configs/primaryColorConfig'

type TenantType = 'sole_trader' | 'company'

export const CreateTenantForm = () => {
  const router = useRouter()
  const [name, setName] = useState<string>('')
  const [type, setType] = useState<TenantType>('sole_trader')
  const [primaryColor, setPrimaryColor] = useState<string>(primaryColorConfig[0].main)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null)
  const [step, setStep] = useState<number>(0)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const steps = useMemo(() => ['Select plan', 'Organisation details'], [])

  const handleSubmit = async () => {
    setError(null)

    if (!name.trim()) {
      setError('Please enter an organisation name')

      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          subscriptionPlanId: selectedPlanId || undefined,
          primaryColor
        })
      })

      const data: any = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create organisation')
      }

      const tenantId: string | undefined = data?.tenantId

      if (tenantId) {
        try {
          await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/theme`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ primaryColor })
          })
        } catch {
          // theme is optional
        }

        const form = new FormData()

        form.append('tenantId', tenantId)

        try {
          await fetch('/api/session/tenant?return=json', { method: 'POST', body: form })
        } catch {
          // session switch is best-effort
        }

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
    <Box className='flex flex-col gap-5'>
      {successMsg ? <Alert severity='success'>{successMsg}</Alert> : null}

      <Paper
        variant='outlined'
        sx={{
          borderRadius: 3,
          px: { xs: 2, sm: 3 },
          py: 2,
          bgcolor: 'background.paper'
        }}
      >
        <Stepper activeStep={step} alternativeLabel>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      {step === 0 ? (
        <>
          <SubscriptionPlansPicker
            selectedPlanId={selectedPlanId}
            onSelect={(id, plan) => {
              setSelectedPlanId(id)
              setSelectedPlanName(plan?.name || null)
            }}
          />
          <Box
            sx={{
              position: { sm: 'sticky' },
              bottom: 0,
              py: 2,
              mt: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexWrap: 'wrap',
              borderTop: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              zIndex: 2
            }}
          >
            <Typography variant='body2' color='text.secondary'>
              {selectedPlanId ? 'Plan selected — continue to organisation details.' : 'Select a plan to continue.'}
            </Typography>
            <Button
              variant='contained'
              size='large'
              onClick={() => setStep(1)}
              disabled={!selectedPlanId}
              endIcon={<i className='ri-arrow-right-line' />}
            >
              Continue
            </Button>
          </Box>
        </>
      ) : (
        <Card variant='outlined' sx={{ borderRadius: 3, boxShadow: 'none', maxWidth: 640 }}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, p: { xs: 2.5, sm: 3.5 } }}>
            <Box>
              <Typography variant='h6' sx={{ fontWeight: 700 }}>
                Organisation details
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                Tell us how this organisation should appear in the workspace.
              </Typography>
            </Box>

            {selectedPlanId ? (
              <Chip
                color='primary'
                variant='outlined'
                icon={<i className='ri-vip-crown-line' />}
                label={selectedPlanName ? `Selected plan: ${selectedPlanName}` : 'Plan selected'}
                sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
              />
            ) : null}

            <TextField
              label='Organisation name'
              value={name}
              onChange={e => setName(e.target.value)}
              fullWidth
              autoFocus
            />
            <FormControl fullWidth>
              <InputLabel id='tenant-type-label'>Type</InputLabel>
              <Select
                labelId='tenant-type-label'
                label='Type'
                value={type}
                onChange={e => setType(e.target.value as TenantType)}
              >
                <MenuItem value='sole_trader'>Sole trader</MenuItem>
                <MenuItem value='company'>Company</MenuItem>
              </Select>
            </FormControl>

            <Box>
              <Typography variant='subtitle2' color='text.secondary'>
                Brand colour
              </Typography>
              <Typography variant='caption' color='text.secondary' display='block' sx={{ mb: 1 }}>
                Used for this organisation’s theme accents.
              </Typography>
              <Box className='flex items-center gap-2 flex-wrap'>
                {primaryColorConfig.map(c => (
                  <Button
                    key={c.main}
                    variant={primaryColor === c.main ? 'outlined' : 'text'}
                    onClick={() => setPrimaryColor(c.main)}
                    aria-label={`Select colour ${c.main}`}
                    sx={{
                      minWidth: 0,
                      p: 0.5,
                      borderRadius: '10px',
                      borderColor: primaryColor === c.main ? c.main : undefined
                    }}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        backgroundColor: c.main,
                        boxShadow: primaryColor === c.main ? `0 0 0 2px ${c.main}` : 'none'
                      }}
                    />
                  </Button>
                ))}
              </Box>
            </Box>

            {error ? <Alert severity='error'>{error}</Alert> : null}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 0.5 }}>
              <Button variant='text' onClick={() => setStep(0)} startIcon={<i className='ri-arrow-left-line' />}>
                Back
              </Button>
              <Button variant='contained' size='large' disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Creating…' : 'Create organisation'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  )
}
