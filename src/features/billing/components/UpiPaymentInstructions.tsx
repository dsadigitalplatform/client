'use client'

import { useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Stack from '@mui/material/Stack'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import { getUpiPaymentConfig } from '../upiPaymentConfig'
import { PayAmountDisplay } from '@features/subscriptions/components/PayAmountDisplay'
import type { SubscriptionPricing } from '@features/subscriptions/subscriptions.types'

type UpiPaymentInstructionsProps = {
  amountLabel?: string | null
  pricing?: SubscriptionPricing | null
  organisationName?: string | null
  planName?: string | null
}

async function copyText(value: string) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)

    return
  }

  const el = document.createElement('textarea')

  el.value = value
  el.setAttribute('readonly', '')
  el.style.position = 'absolute'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

export function UpiPaymentInstructions(props: UpiPaymentInstructionsProps) {
  const cfg = getUpiPaymentConfig()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [toast, setToast] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const remarkHint = [props.organisationName, props.planName].filter(Boolean).join(' · ') || 'your organisation name'

  const onCopy = async (value: string, label: string) => {
    try {
      await copyText(value)
      setToast(`${label} copied`)
    } catch {
      setToast(`Could not copy ${label.toLowerCase()}`)
    }
  }

  return (
    <Box
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        bgcolor: 'background.paper'
      }}
    >
      <Box
        sx={{
          px: 2.25,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.5,
          flexWrap: 'wrap',
          bgcolor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}
      >
        <Stack direction='row' spacing={1} alignItems='center'>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              fontWeight: 800
            }}
          >
            <i className='ri-qr-scan-2-line' style={{ fontSize: 18 }} />
          </Box>
          <Box>
            <Typography variant='subtitle1' sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              Pay with UPI
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              Scan to pay with any UPI app · {cfg.bankName}
            </Typography>
          </Box>
        </Stack>
        {props.pricing ? (
          <PayAmountDisplay pricing={props.pricing} />
        ) : props.amountLabel ? (
          <Chip color='primary' variant='filled' label={`Pay ${props.amountLabel}`} sx={{ fontWeight: 700 }} />
        ) : null}
      </Box>

      <Box
        sx={{
          p: { xs: 2, md: 2.5 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 280px) 1fr' },
          gap: { xs: 2.5, md: 3 },
          alignItems: 'start'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
          <Box
            component='button'
            type='button'
            onClick={() => setQrOpen(true)}
            aria-label='Expand QR code for easier scanning'
            sx={{
              p: 1.25,
              borderRadius: 2.5,
              bgcolor: '#fff',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: '0 10px 28px rgb(15 23 42 / 0.08)',
              cursor: 'pointer',
              position: 'relative',
              display: 'block',
              width: '100%',
              maxWidth: 260,
              textAlign: 'center',
              '&:hover .qr-expand-hint': { opacity: 1 }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.qrImageSrc}
              alt={cfg.qrAlt}
              width={240}
              height={240}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8 }}
            />
            <Box
              className='qr-expand-hint'
              sx={{
                position: 'absolute',
                right: 10,
                bottom: 10,
                px: 1,
                py: 0.5,
                borderRadius: 1.5,
                bgcolor: 'rgb(15 23 42 / 0.78)',
                color: '#fff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                opacity: { xs: 1, md: 0.85 },
                transition: 'opacity 0.15s ease'
              }}
            >
              <i className='ri-fullscreen-line' style={{ fontSize: 14 }} />
              <Typography variant='caption' sx={{ fontWeight: 700, lineHeight: 1 }}>
                Expand
              </Typography>
            </Box>
          </Box>
          <Button size='small' variant='outlined' startIcon={<i className='ri-zoom-in-line' />} onClick={() => setQrOpen(true)}>
            Expand QR for scanning
          </Button>
          <Typography variant='caption' color='text.secondary' sx={{ textAlign: 'center', maxWidth: 260 }}>
            Open GPay, PhonePe, Paytm, BHIM or any UPI app and scan this QR.
          </Typography>
        </Box>

        <Stack spacing={2}>
          <Box>
            <Typography variant='overline' color='text.secondary' sx={{ letterSpacing: 0.8 }}>
              Payee
            </Typography>
            <Typography variant='h6' sx={{ fontWeight: 800, letterSpacing: '-0.02em', mt: 0.25 }}>
              {cfg.payeeName}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {cfg.bankName}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'stretch', sm: 'center' },
              gap: 1,
              flexDirection: { xs: 'column', sm: 'row' },
              p: 1.25,
              borderRadius: 2,
              bgcolor: 'action.hover',
              border: '1px dashed',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant='caption' color='text.secondary'>
                UPI ID
              </Typography>
              <Typography variant='subtitle1' sx={{ fontWeight: 800, color: 'primary.main', wordBreak: 'break-all' }}>
                {cfg.vpa}
              </Typography>
            </Box>
            <Button
              variant='contained'
              size='small'
              startIcon={<i className='ri-file-copy-line' />}
              onClick={() => void onCopy(cfg.vpa, 'UPI ID')}
              sx={{ whiteSpace: 'nowrap', alignSelf: { sm: 'center' } }}
            >
              Copy UPI ID
            </Button>
          </Box>

          {props.amountLabel ? (
            <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap' useFlexGap>
              <Typography variant='body2' color='text.secondary'>
                Amount to transfer
              </Typography>
              <Typography variant='subtitle1' sx={{ fontWeight: 800 }}>
                {props.amountLabel}
              </Typography>
              <Tooltip title='Copy amount label'>
                <IconButton size='small' onClick={() => void onCopy(props.amountLabel || '', 'Amount')} aria-label='Copy amount'>
                  <i className='ri-file-copy-line' style={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}

          <Alert severity='info' icon={<i className='ri-information-line' />} sx={{ borderRadius: 2 }}>
            After payment, keep the UPI reference / UTR. Paste it in the note below and notify Super Admin so we can
            mark payment received and activate your paid period.
          </Alert>

          <Box>
            <Typography variant='subtitle2' sx={{ fontWeight: 700, mb: 1 }}>
              How to pay
            </Typography>
            <Box component='ol' sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography component='li' variant='body2'>
                Scan the QR, or pay to <strong>{cfg.vpa}</strong> from any UPI app.
              </Typography>
              <Typography component='li' variant='body2'>
                Enter the exact amount{props.amountLabel ? ` (${props.amountLabel})` : ' for your selected plan'}.
              </Typography>
              <Typography component='li' variant='body2'>
                In remarks / note, add <strong>{remarkHint}</strong> so we can match the payment.
              </Typography>
              <Typography component='li' variant='body2'>
                Complete the transfer, then copy the UTR / UPI reference from your app.
              </Typography>
              <Typography component='li' variant='body2'>
                Notify Super Admin with that reference. Activation is confirmed after payment is verified.
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Dialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        fullWidth
        maxWidth='sm'
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            bgcolor: '#f4f4f5',
            m: { xs: 0, sm: 2 },
            borderRadius: { xs: 0, sm: 3 }
          }
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <Stack direction='row' spacing={1} alignItems='center' justifyContent='space-between' sx={{ width: '100%' }}>
            <Box>
              <Typography variant='h6' sx={{ fontWeight: 800 }}>
                Scan to pay
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                {cfg.payeeName} · {cfg.vpa}
              </Typography>
            </Box>
            <IconButton onClick={() => setQrOpen(false)} aria-label='Close expanded QR'>
              <i className='ri-close-line' />
            </IconButton>
          </Stack>

          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              bgcolor: '#fff',
              borderRadius: 3,
              boxShadow: '0 16px 40px rgb(15 23 42 / 0.12)',
              width: '100%',
              maxWidth: 440
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cfg.qrImageSrc}
              alt={cfg.qrAlt}
              style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 8 }}
            />
          </Box>

          {props.pricing ? (
            <PayAmountDisplay pricing={props.pricing} align='center' />
          ) : props.amountLabel ? (
            <Chip color='primary' label={`Pay ${props.amountLabel}`} sx={{ fontWeight: 700 }} />
          ) : null}

          <Typography variant='body2' color='text.secondary' sx={{ textAlign: 'center' }}>
            Hold your UPI app over this screen. Brightness up helps the scanner lock faster.
          </Typography>

          <Button variant='contained' onClick={() => setQrOpen(false)} fullWidth={isMobile}>
            Done
          </Button>
        </Box>
      </Dialog>
    </Box>
  )
}
