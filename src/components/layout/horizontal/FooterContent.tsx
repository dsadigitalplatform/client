'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

// Util Imports
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useHorizontalNav()

  return (
    <div
      className={classnames(horizontalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
    >
      <p>
        <Link href='https://sidhiyana.com/' target='_blank' className='text-primary'>
          © Sidhiyana Pvt Ltd
        </Link>
      </p>
      {!isBreakpointReached && <div className='flex items-center gap-4' />}
    </div>
  )
}

export default FooterContent
