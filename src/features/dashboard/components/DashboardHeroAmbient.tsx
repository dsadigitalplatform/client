'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import { keyframes } from '@mui/material/styles'

export type HeroAmbientVariant =
  | 'soft-orbs'
  | 'shimmer-sweep'
  | 'ripple-glow'
  | 'aurora-drift'
  | 'breathing-halo'
  | 'sparkle-dots'

export const HERO_AMBIENT_VARIANTS: HeroAmbientVariant[] = [
  'soft-orbs',
  'shimmer-sweep',
  'ripple-glow',
  'aurora-drift',
  'breathing-halo',
  'sparkle-dots'
]

const STORAGE_KEY = 'dashboard-hero-ambient-v2'

const floatA = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(-36px, 28px, 0) scale(1.2); }
`

const floatB = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(32px, -24px, 0) scale(1.25); }
`

const floatC = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) scale(0.9); opacity: 0.35; }
  50% { transform: translate3d(20px, 18px, 0) scale(1.25); opacity: 0.7; }
`

const shimmer = keyframes`
  0% { transform: translateX(-130%) skewX(-12deg); }
  100% { transform: translateX(230%) skewX(-12deg); }
`

const ripple = keyframes`
  0% { transform: scale(0.35); opacity: 0.4; }
  100% { transform: scale(1.7); opacity: 0; }
`

const auroraA = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
  33% { transform: translate3d(48px, -28px, 0) rotate(10deg) scale(1.15); }
  66% { transform: translate3d(-32px, 36px, 0) rotate(-8deg) scale(0.95); }
`

const auroraB = keyframes`
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(-52px, 22px, 0) scale(1.3); }
`

const breathe = keyframes`
  0%, 100% { transform: scale(0.9); opacity: 0.25; }
  50% { transform: scale(1.2); opacity: 0.55; }
`

const sparkle = keyframes`
  0%, 100% { transform: translateY(0) scale(0.6); opacity: 0.12; }
  40% { transform: translateY(-12px) scale(1.2); opacity: 0.55; }
  70% { transform: translateY(-5px) scale(1); opacity: 0.35; }
`

const reducedMotionSx = {
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none !important'
  }
}

const layerBase = {
  position: 'absolute' as const,
  pointerEvents: 'none' as const,
  zIndex: 0,
  ...reducedMotionSx
}

function pickRandomVariant(): HeroAmbientVariant {
  const idx = Math.floor(Math.random() * HERO_AMBIENT_VARIANTS.length)

  return HERO_AMBIENT_VARIANTS[idx] ?? 'soft-orbs'
}

function resolveVariant(): HeroAmbientVariant {
  if (typeof window === 'undefined') return 'soft-orbs'

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)

    if (stored && (HERO_AMBIENT_VARIANTS as string[]).includes(stored)) {
      return stored as HeroAmbientVariant
    }

    const next = pickRandomVariant()

    sessionStorage.setItem(STORAGE_KEY, next)

    return next
  } catch {
    return pickRandomVariant()
  }
}

function SoftOrbs() {
  return (
    <>
      <Box
        sx={{
          ...layerBase,
          width: 320,
          height: 320,
          borderRadius: '50%',
          top: -110,
          right: -70,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.28) 0%, rgb(255 255 255 / 0.08) 42%, transparent 70%)',
          animation: `${floatA} 7s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 220,
          height: 220,
          borderRadius: '50%',
          bottom: -70,
          left: -50,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.22) 0%, rgb(255 255 255 / 0.06) 45%, transparent 72%)',
          animation: `${floatB} 6s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 130,
          height: 130,
          borderRadius: '50%',
          top: '38%',
          right: '16%',
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.32) 0%, rgb(255 255 255 / 0.08) 40%, transparent 72%)',
          animation: `${floatC} 5s ease-in-out infinite`
        }}
      />
    </>
  )
}

function ShimmerSweep() {
  return (
    <>
      <Box
        sx={{
          ...layerBase,
          width: 260,
          height: 260,
          borderRadius: '50%',
          top: -90,
          right: -50,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.18) 0%, transparent 70%)'
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 180,
          height: 180,
          borderRadius: '50%',
          bottom: -60,
          left: -40,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.14) 0%, transparent 70%)'
        }}
      />
      <Box
        sx={{
          ...layerBase,
          top: 0,
          bottom: 0,
          left: 0,
          width: '42%',
          background:
            'linear-gradient(90deg, transparent 0%, rgb(255 255 255 / 0.04) 30%, rgb(255 255 255 / 0.2) 50%, rgb(255 255 255 / 0.04) 70%, transparent 100%)',
          animation: `${shimmer} 4.5s ease-in-out infinite`
        }}
      />
    </>
  )
}

function RippleGlow() {
  return (
    <>
      <Box
        sx={{
          ...layerBase,
          width: 90,
          height: 90,
          borderRadius: '50%',
          top: 24,
          right: 48,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.35) 0%, rgb(255 255 255 / 0.1) 55%, transparent 75%)'
        }}
      />
      {[0, 1, 2].map(i => (
        <Box
          key={i}
          sx={{
            ...layerBase,
            width: 220,
            height: 220,
            borderRadius: '50%',
            top: -40,
            right: -16,
            border: '1px solid rgb(255 255 255 / 0.28)',
            boxShadow: '0 0 16px rgb(255 255 255 / 0.12)',
            background: 'radial-gradient(circle, rgb(255 255 255 / 0.1) 0%, transparent 60%)',
            animation: `${ripple} 4.8s ease-out infinite`,
            animationDelay: `${i * 1.6}s`
          }}
        />
      ))}
      <Box
        sx={{
          ...layerBase,
          width: 160,
          height: 160,
          borderRadius: '50%',
          bottom: -50,
          left: -30,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.16) 0%, transparent 70%)',
          animation: `${breathe} 5.5s ease-in-out infinite`
        }}
      />
    </>
  )
}

function AuroraDrift() {
  return (
    <>
      <Box
        sx={{
          ...layerBase,
          width: 380,
          height: 240,
          borderRadius: '50%',
          top: -90,
          right: -100,
          background: 'radial-gradient(ellipse, rgb(255 255 255 / 0.26) 0%, rgb(255 255 255 / 0.08) 45%, transparent 70%)',
          filter: 'blur(8px)',
          animation: `${auroraA} 9s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 300,
          height: 200,
          borderRadius: '50%',
          bottom: -90,
          left: -60,
          background: 'radial-gradient(ellipse, rgb(255 255 255 / 0.2) 0%, rgb(255 255 255 / 0.06) 50%, transparent 72%)',
          filter: 'blur(8px)',
          animation: `${auroraB} 7.5s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 220,
          height: 140,
          borderRadius: '50%',
          top: '28%',
          left: '32%',
          background: 'radial-gradient(ellipse, rgb(255 255 255 / 0.18) 0%, transparent 70%)',
          filter: 'blur(6px)',
          animation: `${auroraA} 11s ease-in-out infinite reverse`
        }}
      />
    </>
  )
}

function BreathingHalo() {
  return (
    <>
      <Box
        sx={{
          ...layerBase,
          width: 300,
          height: 300,
          borderRadius: '50%',
          top: -110,
          right: -60,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.3) 0%, rgb(255 255 255 / 0.1) 38%, transparent 68%)',
          animation: `${breathe} 4.2s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 210,
          height: 210,
          borderRadius: '50%',
          bottom: -70,
          left: -50,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.24) 0%, rgb(255 255 255 / 0.07) 42%, transparent 70%)',
          animation: `${breathe} 5.2s ease-in-out infinite`,
          animationDelay: '0.9s'
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 120,
          height: 120,
          borderRadius: '50%',
          top: '40%',
          right: '22%',
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.3) 0%, transparent 70%)',
          animation: `${breathe} 3.6s ease-in-out infinite`,
          animationDelay: '0.4s'
        }}
      />
    </>
  )
}

function SparkleDots() {
  const dots = [
    { top: '16%', left: '70%', size: 10, delay: '0s', duration: '2.8s' },
    { top: '32%', left: '86%', size: 7, delay: '0.4s', duration: '3.2s' },
    { top: '58%', left: '76%', size: 9, delay: '0.9s', duration: '2.6s' },
    { top: '20%', left: '55%', size: 6, delay: '1.2s', duration: '3.5s' },
    { top: '68%', left: '14%', size: 8, delay: '0.2s', duration: '3s' },
    { top: '44%', left: '10%', size: 7, delay: '1s', duration: '2.5s' },
    { top: '10%', left: '38%', size: 6, delay: '1.6s', duration: '3.4s' },
    { top: '78%', left: '48%', size: 5, delay: '0.7s', duration: '2.9s' }
  ]

  return (
    <>
      <Box
        sx={{
          ...layerBase,
          width: 280,
          height: 280,
          borderRadius: '50%',
          top: -100,
          right: -50,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.18) 0%, transparent 70%)',
          animation: `${floatA} 8s ease-in-out infinite`
        }}
      />
      <Box
        sx={{
          ...layerBase,
          width: 180,
          height: 180,
          borderRadius: '50%',
          bottom: -60,
          left: -40,
          background: 'radial-gradient(circle, rgb(255 255 255 / 0.14) 0%, transparent 70%)',
          animation: `${floatB} 7s ease-in-out infinite`
        }}
      />
      {dots.map((d, i) => (
        <Box
          key={i}
          sx={{
            ...layerBase,
            top: d.top,
            left: d.left,
            width: d.size,
            height: d.size,
            borderRadius: '50%',
            background: 'rgb(255 255 255 / 0.55)',
            boxShadow: '0 0 10px 2px rgb(255 255 255 / 0.3)',
            animation: `${sparkle} ${d.duration} ease-in-out infinite`,
            animationDelay: d.delay
          }}
        />
      ))}
    </>
  )
}

function AmbientLayers({ variant }: { variant: HeroAmbientVariant }) {
  switch (variant) {
    case 'shimmer-sweep':
      return <ShimmerSweep />
    case 'ripple-glow':
      return <RippleGlow />
    case 'aurora-drift':
      return <AuroraDrift />
    case 'breathing-halo':
      return <BreathingHalo />
    case 'sparkle-dots':
      return <SparkleDots />
    case 'soft-orbs':
    default:
      return <SoftOrbs />
  }
}

export default function DashboardHeroAmbient() {
  const [variant, setVariant] = useState<HeroAmbientVariant | null>(null)

  useEffect(() => {
    setVariant(resolveVariant())
  }, [])

  if (!variant) return null

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0
      }}
    >
      <AmbientLayers variant={variant} />
    </Box>
  )
}
