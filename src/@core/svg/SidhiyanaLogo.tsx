'use client'

import type { SVGAttributes } from 'react'

import { Orbitron } from 'next/font/google'

const orbitronLight = Orbitron({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  variable: '--font-orbitron'
})

const SAFFRON = '#FF7722'
const TAGLINE = '#8d8281'
/** One continuous shooting-star journey + quick sharp splash on the frame lines */
const CYCLE = '11s'

/**
 * Top bar as a path so corners can differ:
 * TL + BL + BR rounded (r=7.5); TR square.
 */
const TOP_BAR_PATH =
  'M42.5 110 H103 V117.5 A7.5 7.5 0 0 1 95.5 125 H42.5 A7.5 7.5 0 0 1 42.5 110 Z'

type SidhiyanaLogoProps = SVGAttributes<SVGElement> & {
  title?: string
  /** When false, omits corner frames and uses a shorter crop. Default true. */
  showFrame?: boolean
}

type OpacityAnim = {
  values: string
  keyTimes: string
}

/**
 * Sharp comet-style shooting star: long tapered trail, bright needle core, pointed head.
 * Oriented so +X is travel direction (trail streams behind via rotate="auto").
 */
const ShootingStar = ({ opacity, shine = false }: { opacity: OpacityAnim; shine?: boolean }) => {
  // Trail stays softer / shorter than the head so the star reads clearly
  const trailOpacity = {
    values: opacity.values
      .split(';')
      .map(v => {
        const n = Number(v)

        return Number.isFinite(n) ? String(Number((n * 0.55).toFixed(2))) : v
      })
      .join(';'),
    keyTimes: opacity.keyTimes
  }

  // Launch zoom tied to visibility — blooms as the star appears
  const scaleValues = opacity.values
    .split(';')
    .map(v => {
      const n = Number(v)

      if (!Number.isFinite(n) || n <= 0) return '0.4'
      if (n >= 0.9) return '1'
      if (n >= 0.3) return '1.12'

      return String(Number((0.4 + n * 0.7).toFixed(2)))
    })
    .join(';')

  return (
    <g>
      <animateTransform
        attributeName='transform'
        type='scale'
        values={scaleValues}
        keyTimes={opacity.keyTimes}
        dur={CYCLE}
        repeatCount='indefinite'
      />
      {/* Soft plume — enough length to read as a launch zoom */}
      <path d='M-24 0 L-0.9 -1.9 L0.35 0 L-0.9 1.9 Z' fill='url(#sidhiyanaStarTrail)' opacity='0'>
        <animate attributeName='opacity' values={trailOpacity.values} keyTimes={trailOpacity.keyTimes} dur={CYCLE} repeatCount='indefinite' />
      </path>
      {/* Soft core streak */}
      <path d='M-18 0 L-0.2 -0.4 L0.7 0 L-0.2 0.4 Z' fill='url(#sidhiyanaStarTrailCore)' opacity='0'>
        <animate attributeName='opacity' values={trailOpacity.values} keyTimes={trailOpacity.keyTimes} dur={CYCLE} repeatCount='indefinite' />
      </path>
      {/* Soft head bloom */}
      <circle cx='0' cy='0' r='2.4' fill='#FFF8EC' opacity='0' filter='url(#sidhiyanaStarHeadGlow)'>
        <animate attributeName='opacity' values={opacity.values} keyTimes={opacity.keyTimes} dur={CYCLE} repeatCount='indefinite' />
      </circle>
      {/* Crisp 4-point star (hero) */}
      <path
        d='M0 -5.4 L0.72 -0.72 L5.4 0 L0.72 0.72 L0 5.4 L-0.72 0.72 L-5.4 0 L-0.72 -0.72 Z'
        fill='#FFFFFF'
        opacity='0'
      >
        <animate attributeName='opacity' values={opacity.values} keyTimes={opacity.keyTimes} dur={CYCLE} repeatCount='indefinite' />
      </path>
      {/* Bright center tip */}
      <circle cx='0' cy='0' r='1.25' fill='#FFFFFF' opacity='0'>
        <animate attributeName='opacity' values={opacity.values} keyTimes={opacity.keyTimes} dur={CYCLE} repeatCount='indefinite' />
      </circle>
      {shine ? (
        <path
          d='M0 -6.2 L0.78 -0.78 L6.2 0 L0.78 0.78 L0 6.2 L-0.78 0.78 L-6.2 0 L-0.78 -0.78 Z'
          fill='#FFFFFF'
          opacity='0'
        >
          <animate
            attributeName='opacity'
            values='0;0;0;0.4;0;0.5;0;0'
            keyTimes='0;0.62;0.66;0.7;0.74;0.77;0.8;1'
            dur={CYCLE}
            repeatCount='indefinite'
          />
        </path>
      ) : null}
    </g>
  )
}

/**
 * Thin shiny splash along a path (frame brackets or wordmark baselines),
 * same timing language as the corner flashes.
 */
const LineSplash = ({
  d,
  pathLen,
  start,
  end,
  glowWidth = 2.4,
  coreWidth = 1.35
}: {
  d: string
  pathLen: number
  start: number
  end: number
  glowWidth?: number
  coreWidth?: number
}) => {
  const splashLen = Math.max(10, Math.round(pathLen * 0.16))
  const coreLen = Math.max(5, Math.round(splashLen * 0.45))
  const gap = pathLen + splashLen
  const fadeIn = start
  const visible = Number((start + 0.008).toFixed(3))
  const fadeOut = end
  const hidden = Number((Math.min(end + 0.008, 0.999)).toFixed(3))
  const offsetKeys = `0;${start};${end};1`
  const offsetVals = `0;0;${-pathLen};${-pathLen}`
  const offsetSplines = '0 0 1 1; 0.2 0 0.1 1; 0 0 1 1'
  const opacityKeys = `0;${fadeIn};${visible};${fadeOut};${hidden};1`

  return (
    <g className='sidhiyana-star-anim'>
      {/* Slim glow trail */}
      <path
        d={d}
        fill='none'
        stroke='#FFFFFF'
        strokeWidth={glowWidth}
        strokeLinecap='round'
        strokeDasharray={`${splashLen} ${gap}`}
        opacity='0'
        filter='url(#sidhiyanaSplashGlow)'
      >
        <animate
          attributeName='opacity'
          values='0;0;0.45;0.45;0;0'
          keyTimes={opacityKeys}
          dur={CYCLE}
          repeatCount='indefinite'
        />
        <animate
          attributeName='stroke-dashoffset'
          values={offsetVals}
          keyTimes={offsetKeys}
          dur={CYCLE}
          repeatCount='indefinite'
          calcMode='spline'
          keySplines={offsetSplines}
        />
      </path>
      {/* Needle-thin bright core */}
      <path
        d={d}
        fill='none'
        stroke='#FFFFFF'
        strokeWidth={coreWidth}
        strokeLinecap='butt'
        strokeDasharray={`${coreLen} ${gap}`}
        opacity='0'
      >
        <animate
          attributeName='opacity'
          values='0;0;0.7;0.7;0;0'
          keyTimes={opacityKeys}
          dur={CYCLE}
          repeatCount='indefinite'
        />
        <animate
          attributeName='stroke-dashoffset'
          values={offsetVals}
          keyTimes={offsetKeys}
          dur={CYCLE}
          repeatCount='indefinite'
          calcMode='spline'
          keySplines={offsetSplines}
        />
      </path>
    </g>
  )
}

/**
 * Frame-style flash across text: a bright band sweeps L→R, clipped to glyphs
 * so letters light up white (same moment in the cycle as the old frame corners).
 */
const TextGlyphFlash = ({
  clipPathId,
  xFrom,
  xTo,
  y,
  height,
  beamWidth,
  start,
  end
}: {
  clipPathId: string
  xFrom: number
  xTo: number
  y: number
  height: number
  beamWidth: number
  start: number
  end: number
}) => {
  const visible = Number((start + 0.01).toFixed(3))
  const hidden = Number((Math.min(end + 0.01, 0.999)).toFixed(3))
  const opacityKeys = `0;${start};${visible};${end};${hidden};1`
  const xKeys = `0;${start};${end};1`

  return (
    <g className='sidhiyana-star-anim' clipPath={`url(#${clipPathId})`}>
      {/* Soft glow band — kept mild so the shooting star stays the hero */}
      <rect x={xFrom} y={y} width={beamWidth * 1.2} height={height} fill='#FFFFFF' opacity='0'>
        <animate
          attributeName='opacity'
          values='0;0;0.14;0.14;0;0'
          keyTimes={opacityKeys}
          dur={CYCLE}
          repeatCount='indefinite'
        />
        <animate
          attributeName='x'
          values={`${xFrom};${xFrom};${xTo};${xTo}`}
          keyTimes={xKeys}
          dur={CYCLE}
          repeatCount='indefinite'
          calcMode='spline'
          keySplines='0 0 1 1; 0.2 0 0.1 1; 0 0 1 1'
        />
      </rect>
      {/* Soft core band */}
      <rect x={xFrom} y={y} width={beamWidth * 0.7} height={height} fill='#FFFFFF' opacity='0'>
        <animate
          attributeName='opacity'
          values='0;0;0.26;0.26;0;0'
          keyTimes={opacityKeys}
          dur={CYCLE}
          repeatCount='indefinite'
        />
        <animate
          attributeName='x'
          values={`${xFrom};${xFrom};${xTo};${xTo}`}
          keyTimes={xKeys}
          dur={CYCLE}
          repeatCount='indefinite'
          calcMode='spline'
          keySplines='0 0 1 1; 0.2 0 0.1 1; 0 0 1 1'
        />
      </rect>
    </g>
  )
}

/**
 * Sidhiyana brand mark — continuous shooting star on the logo;
 * finishing splash runs each frame corner top-left → bottom-right.
 */
const SidhiyanaLogo = ({
  title = 'Sidhiyana Pvt Ltd',
  showFrame = true,
  className,
  ...props
}: SidhiyanaLogoProps) => {
  return (
    <svg
      viewBox={showFrame ? '0 0 440 300' : '0 95 440 110'}
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
      role='img'
      aria-label={title}
      className={`${orbitronLight.variable} ${orbitronLight.className}${className ? ` ${className}` : ''}`}
      {...props}
    >
      <title>{title}</title>

      <defs>
        {showFrame ? (
          <linearGradient id='sidhiyanaFrameGrad' x1='70' y1='0' x2='370' y2='0' gradientUnits='userSpaceOnUse'>
            <stop offset='0%' stopColor='#E84A8A' />
            <stop offset='55%' stopColor={SAFFRON} />
            <stop offset='100%' stopColor={SAFFRON} />
          </linearGradient>
        ) : null}

        <linearGradient id='sidhiyanaSaffronFill' x1='35' y1='0' x2='110' y2='0' gradientUnits='userSpaceOnUse'>
          <stop offset='0%' stopColor='#F25A7A' />
          <stop offset='18%' stopColor={SAFFRON} />
          <stop offset='100%' stopColor={SAFFRON} />
        </linearGradient>

        <clipPath id='sidhiyanaTopBarClip'>
          <path d={TOP_BAR_PATH} />
        </clipPath>

        <clipPath id='sidhiyanaReverseCClip'>
          <rect x='35' y='142' width='68' height='15' rx='7.5' />
          <rect x='88' y='142' width='15' height='45' rx='7.5' />
          <rect x='35' y='174' width='68' height='15' rx='7.5' />
        </clipPath>

        <linearGradient id='sidhiyanaStarTrail' x1='1' y1='0' x2='0' y2='0'>
          <stop offset='0%' stopColor='#FFFFFF' stopOpacity='0.7' />
          <stop offset='25%' stopColor='#FFF4E8' stopOpacity='0.4' />
          <stop offset='65%' stopColor='#FFE0C0' stopOpacity='0.12' />
          <stop offset='100%' stopColor='#FF7722' stopOpacity='0' />
        </linearGradient>

        <linearGradient id='sidhiyanaStarTrailCore' x1='1' y1='0' x2='0' y2='0'>
          <stop offset='0%' stopColor='#FFFFFF' stopOpacity='0.85' />
          <stop offset='40%' stopColor='#FFFFFF' stopOpacity='0.35' />
          <stop offset='100%' stopColor='#FFFFFF' stopOpacity='0' />
        </linearGradient>

        <filter id='sidhiyanaStarGlow' x='-140%' y='-140%' width='380%' height='380%'>
          <feGaussianBlur stdDeviation='1.1' result='b' />
          <feMerge>
            <feMergeNode in='b' />
            <feMergeNode in='SourceGraphic' />
          </feMerge>
        </filter>

        <filter id='sidhiyanaStarHeadGlow' x='-200%' y='-200%' width='500%' height='500%'>
          <feGaussianBlur stdDeviation='1.9' result='b' />
          <feMerge>
            <feMergeNode in='b' />
            <feMergeNode in='SourceGraphic' />
          </feMerge>
        </filter>

        <filter id='sidhiyanaSplashGlow' x='-40%' y='-200%' width='180%' height='500%'>
          <feGaussianBlur stdDeviation='0.75' result='b' />
          <feMerge>
            <feMergeNode in='b' />
            <feMergeNode in='SourceGraphic' />
          </feMerge>
        </filter>

        {!showFrame ? (
          <>
            {/* Explicit fill required — root svg has fill="none", which would empty the clip */}
            <clipPath id='sidhiyanaWordmarkClip'>
              <text
                x='122'
                y='148'
                fill='#000000'
                fontSize='26'
                fontWeight='400'
                letterSpacing='0.4'
                style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}
              >
                Sidhiyana pvt ltd
              </text>
            </clipPath>
            <clipPath id='sidhiyanaTaglineClip'>
              <text
                x='122'
                y='178'
                fill='#000000'
                fontSize='14'
                fontWeight='400'
                letterSpacing='0.6'
                style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}
              >
                ..beyond imagination
              </text>
            </clipPath>
          </>
        ) : null}

        <style>{`
          @media (prefers-reduced-motion: reduce) {
            .sidhiyana-star-anim { display: none; }
          }
        `}</style>
      </defs>

      {showFrame ? (
        <>
          <g stroke='url(#sidhiyanaFrameGrad)' strokeWidth='2' strokeLinecap='square' fill='none'>
            <path d='M68 68 H168 M68 68 V100' />
            <path d='M342 68 H252 M342 68 V100' />
            <path d='M68 232 H168 M68 232 V200' />
            <path d='M342 232 H252 M342 232 V200' />
          </g>

          {/* Quick thin splash on frame corners — TL → BR */}
          <LineSplash d='M68 100 V68 H168' pathLen={132} start={0.7} end={0.78} />
          <LineSplash d='M252 68 H342 V100' pathLen={122} start={0.75} end={0.83} />
          <LineSplash d='M68 200 V232 H168' pathLen={132} start={0.8} end={0.88} />
          <LineSplash d='M252 232 H342 V200' pathLen={122} start={0.85} end={0.93} />
        </>
      ) : null}

      <g fill='url(#sidhiyanaSaffronFill)'>
        <path d={TOP_BAR_PATH} />
        <rect x='35' y='142' width='68' height='15' rx='7.5' />
        <rect x='88' y='142' width='15' height='45' rx='7.5' />
        <rect x='35' y='174' width='68' height='15' rx='7.5' />
      </g>

      {/* 1) Bottom reverse-C — runs first */}
      <g clipPath='url(#sidhiyanaReverseCClip)' className='sidhiyana-star-anim' filter='url(#sidhiyanaStarGlow)'>
        <g>
          <animateMotion
            path='M42 181.5 H95.5 V149.5 H42'
            dur={CYCLE}
            repeatCount='indefinite'
            rotate='auto'
            keyTimes='0;0.03;0.34;1'
            keyPoints='0;0;1;1'
            calcMode='spline'
            keySplines='0 0 1 1; 0.25 0 0.12 1; 0 0 1 1'
          />
          <ShootingStar opacity={{ values: '0;0;1;1;0;0', keyTimes: '0;0.02;0.05;0.32;0.38;1' }} />
        </g>
      </g>

      {/* 2) Top bar — after bottom; early stop + shine */}
      <g clipPath='url(#sidhiyanaTopBarClip)' className='sidhiyana-star-anim' filter='url(#sidhiyanaStarGlow)'>
        <g>
          <animateMotion
            path='M42 117.5 H90'
            dur={CYCLE}
            repeatCount='indefinite'
            rotate='auto'
            keyTimes='0;0.38;0.42;0.62;1'
            keyPoints='0;0;0;1;1'
            calcMode='spline'
            keySplines='0 0 1 1; 0 0 1 1; 0.25 0 0.12 1; 0 0 1 1'
          />
          <ShootingStar
            shine
            opacity={{
              values: '0;0;1;1;1;0.35;1;0;0',
              keyTimes: '0;0.38;0.44;0.62;0.66;0.7;0.74;0.8;1'
            }}
          />
        </g>
      </g>

      <text
        x='122'
        y='148'
        fill={SAFFRON}
        fontSize='26'
        fontWeight='400'
        letterSpacing='0.4'
        style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}
      >
        Sidhiyana pvt ltd
      </text>

      <text
        x='122'
        y='178'
        fill={TAGLINE}
        fontSize='14'
        fontWeight='400'
        letterSpacing='0.6'
        style={{ fontFamily: 'var(--font-orbitron), Orbitron, sans-serif' }}
      >
        ..beyond imagination
      </text>

      {/* No-frame: bright band sweeps across glyphs (same slot as frame corner flash) */}
      {!showFrame ? (
        <>
          <TextGlyphFlash
            clipPathId='sidhiyanaWordmarkClip'
            xFrom={100}
            xTo={350}
            y={120}
            height={36}
            beamWidth={40}
            start={0.62}
            end={0.78}
          />
          <TextGlyphFlash
            clipPathId='sidhiyanaTaglineClip'
            xFrom={100}
            xTo={300}
            y={162}
            height={22}
            beamWidth={30}
            start={0.72}
            end={0.88}
          />
        </>
      ) : null}
    </svg>
  )
}

export default SidhiyanaLogo
