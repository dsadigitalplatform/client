'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const FooterContent = () => {
  // Hooks
  const { isBreakpointReached } = useVerticalNav()

  return (
    <div
      className={classnames(verticalLayoutClasses.footerContent, 'flex items-center justify-between flex-wrap gap-4')}
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
