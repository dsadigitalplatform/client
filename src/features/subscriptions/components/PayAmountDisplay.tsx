'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

import type { SubscriptionPricing } from '@features/subscriptions/subscriptions.types'

type Props = {
  pricing: SubscriptionPricing
  prefix?: string
  align?: 'left' | 'right' | 'center'
}

export function PayAmountDisplay({ pricing, prefix = 'Pay', align = 'right' }: Props) {
  const discounted = Boolean(pricing.discount && pricing.discountAmount > 0)

  return (
    <Box sx={{ textAlign: align, minWidth: 0 }}>
      {discounted ? (
        <>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ textDecoration: 'line-through', fontWeight: 500, lineHeight: 1.2 }}
          >
            {pricing.originalLabel} {pricing.intervalSuffix}
          </Typography>
          <Typography variant='h6' sx={{ fontWeight: 800, lineHeight: 1.25, color: 'success.main' }}>
            {prefix} {pricing.payableLabel} {pricing.intervalSuffix}
          </Typography>
          {pricing.discountCaption ? (
            <Chip
              size='small'
              color='success'
              variant='outlined'
              icon={<i className='ri-coupon-3-line' style={{ fontSize: 14 }} />}
              label={pricing.discountCaption}
              sx={{ mt: 0.75, fontWeight: 700, height: 26 }}
            />
          ) : null}
        </>
      ) : (
        <Chip color='primary' variant='filled' label={`${prefix} ${pricing.payLabel}`} sx={{ fontWeight: 700 }} />
      )}
    </Box>
  )
}
