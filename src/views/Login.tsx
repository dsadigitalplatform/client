'use client'

// Next Imports
import { useRouter } from 'next/navigation'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import Illustrations from '@components/Illustrations'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'
import { useSettings } from '@core/hooks/useSettings'

const LoginV2 = ({ mode }: { mode: Mode }) => {
  // Vars
  const darkImg = '/images/pages/auth-v2-mask-dark.png'
  const lightImg = '/images/pages/auth-v2-mask-light.png'
  const darkIllustration = '/images/illustrations/auth/dsa-hero-pro-dark.svg'
  const lightIllustration = '/images/illustrations/auth/dsa-hero-pro-light.svg'
  const borderedDarkIllustration = '/images/illustrations/auth/dsa-hero-pro-dark.svg'
  const borderedLightIllustration = '/images/illustrations/auth/dsa-hero-pro-light.svg'

  // Hooks
  const router = useRouter()
  const { settings } = useSettings()
  const authBackground = useImageVariant(mode, lightImg, darkImg)

  const characterIllustration = useImageVariant(
    mode,
    lightIllustration,
    darkIllustration,
    borderedLightIllustration,
    borderedDarkIllustration
  )

  const handleGoogle = () => {
    router.push('/')
  }
  
  const handleFacebook = () => {
    router.push('/')
  }

  return (
    <div className='flex bs-full justify-center'>
      <div
        className={classnames(
          'flex bs-full items-center justify-center flex-1 min-bs-[100dvh] relative p-6 max-md:hidden',
          {
            'border-ie': settings.skin === 'bordered'
          }
        )}
      >
        <div className='flex items-center justify-center is-full bs-full'>
          <img
            src={characterIllustration}
            alt='Sales agent centered with ideas and profit graphs'
            className='max-bs-[600px] is-auto bs-auto object-contain relative z-[1]'
          />
        </div>
        <Illustrations
          image1={{ src: '/images/illustrations/objects/tree-2.png' }}
          image2={null}
          maskImg={{ src: authBackground }}
        />
      </div>
      <div className='flex justify-center items-center bs-full bg-backgroundPaper !min-is-full p-6 md:!min-is-[unset] md:p-12 md:is-[480px]'>
        <Link className='absolute block-start-5 sm:block-start-[38px] inline-start-6 sm:inline-start-[38px]'>
          <Logo />
        </Link>
        <div className='flex flex-col gap-5 is-full sm:is-auto md:is-full sm:max-is-[400px] md:max-is-[unset]'>
          <div>
            <Typography variant='h4'>{`Welcome to ${themeConfig.templateName}!`}</Typography>
            
          </div>
          <div className='flex flex-col gap-4'>
            <Button
              fullWidth
              variant='contained'
              onClick={handleGoogle}
              startIcon={<i className='ri-google-fill' />}
              sx={{
                py: 2,
                borderColor: 'var(--mui-palette-divider)',
                color: 'var(--mui-palette-text-primary)',
                backgroundColor: 'var(--mui-palette-background-paper)',
                '& i': { color: '#EA4335', fontSize: '20px' }
              }}
            >
              Continue with Google
            </Button>
            <Button
              fullWidth
              variant='contained'
              onClick={handleFacebook}
              startIcon={<i className='ri-facebook-fill' />}
              sx={{
                py: 2,
                backgroundColor: '#1877F2',
                color: '#FFFFFF',
                '&:hover': { backgroundColor: '#166FE5' },
                '& i': { color: '#FFFFFF', fontSize: '20px' }
              }}
            >
              Continue with Facebook
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginV2
