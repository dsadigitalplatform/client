'use client'

import Link from 'next/link'

import type { SxProps, Theme } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import MuiLink from '@mui/material/Link'
import Typography from '@mui/material/Typography'

export function normalizeLeadCode(code: string | null | undefined) {
  const trimmed = String(code || '').trim()

  return trimmed.length > 0 ? trimmed : null
}

export function leadMatchesQuery(
  query: string,
  fields: {
    code?: string | null
    customerName?: string | null
    loanTypeName?: string | null
    bankName?: string | null
    stageName?: string | null
  }
) {
  const q = query.trim().toLowerCase()

  if (!q) return true

  return [
    fields.code,
    fields.customerName,
    fields.loanTypeName,
    fields.bankName,
    fields.stageName
  ].some(v => String(v || '').toLowerCase().includes(q))
}

type LeadCodeChipProps = {
  code: string | null | undefined
  size?: 'small' | 'medium'
  variant?: 'filled' | 'outlined'
  color?: 'default' | 'primary' | 'secondary'
  sx?: SxProps<Theme>
}

export function LeadCodeChip({
  code,
  size = 'small',
  variant = 'outlined',
  color = 'primary',
  sx
}: LeadCodeChipProps) {
  const normalized = normalizeLeadCode(code)

  if (!normalized) return null

  return (
    <Chip
      size={size}
      label={normalized}
      color={color}
      variant={variant}
      sx={{
        fontFamily: 'monospace',
        fontWeight: 700,
        letterSpacing: 0.3,
        maxWidth: '100%',
        '& .MuiChip-label': {
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        },
        ...sx
      }}
    />
  )
}

type LeadCodeTextProps = {
  code: string | null | undefined
  fallback?: string
  monospace?: boolean
  fontWeight?: number | string
  sx?: SxProps<Theme>
}

export function LeadCodeText({
  code,
  fallback = '—',
  monospace = true,
  fontWeight = 600,
  sx
}: LeadCodeTextProps) {
  const normalized = normalizeLeadCode(code)

  return (
    <Typography
      variant='caption'
      component='span'
      color='text.secondary'
      sx={{
        fontWeight,
        lineHeight: 1.35,
        ...(monospace ? { fontFamily: 'monospace', letterSpacing: 0.3 } : {}),
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        display: 'block',
        ...sx
      }}
      title={normalized || undefined}
    >
      {normalized || fallback}
    </Typography>
  )
}

type LeadIdentityProps = {
  customerName: string | null | undefined
  code?: string | null
  subtitle?: string | null
  href?: string
  nameSx?: SxProps<Theme>
  size?: 'default' | 'large'
}

export function LeadIdentity({ customerName, code, subtitle, href, nameSx, size = 'default' }: LeadIdentityProps) {
  const normalizedCode = normalizeLeadCode(code)
  const name = String(customerName || '').trim() || 'Customer'
  const nameVariant = size === 'large' ? 'body1' : 'body2'

  const nameNode = href ? (
    <MuiLink
      component={Link}
      href={href}
      underline='hover'
      color='text.primary'
      sx={{
        fontWeight: 800,
        fontSize: size === 'large' ? '1rem' : undefined,
        display: 'block',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        ...nameSx
      }}
      title={name}
    >
      {name}
    </MuiLink>
  ) : (
    <Typography variant={nameVariant} sx={{ fontWeight: 800, ...nameSx }} noWrap title={name}>
      {name}
    </Typography>
  )

  return (
    <Box sx={{ minWidth: 0 }}>
      {nameNode}
      {normalizedCode ? <LeadCodeText code={normalizedCode} sx={{ mt: 0.2 }} /> : null}
      {subtitle ? (
        <Typography variant='caption' color='text.secondary' noWrap sx={{ display: 'block', mt: 0.25 }} title={subtitle}>
          {subtitle}
        </Typography>
      ) : null}
    </Box>
  )
}
