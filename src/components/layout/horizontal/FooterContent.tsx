'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Component Imports
import SidhiyanaLogo from '@core/svg/SidhiyanaLogo'

// Util Imports
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  return (
    <div
      className={classnames(horizontalLayoutClasses.footerContent, 'flex items-center justify-end flex-wrap gap-4')}
    >
      <Link
        href='https://sidhiyana.com/'
        target='_blank'
        rel='noopener noreferrer'
        className='inline-flex items-center me-14 sm:me-16 text-textSecondary hover:opacity-90 transition-opacity'
        aria-label='Sidhiyana Pvt Ltd'
      >
        <SidhiyanaLogo
          showFrame={false}
          className='h-10 w-auto sm:h-12 md:h-14 max-w-full'
          title='Sidhiyana Pvt Ltd'
        />
      </Link>
    </div>
  )
}

export default FooterContent
