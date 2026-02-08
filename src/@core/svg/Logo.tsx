// React Imports
import type { SVGAttributes } from 'react'

const Logo = (props: SVGAttributes<SVGElement>) => {
  return (
    <svg width='1.2658em' height='1em' viewBox='0 0 100 79' fill='none' xmlns='http://www.w3.org/2000/svg' {...props}>
      <path
        fillRule='evenodd'
        clipRule='evenodd'
        d='M10 10 H 40 Q 90 10 90 39.5 Q 90 69 40 69 H 10 Z
           M20 20 H 38 Q 75 20 75 39.5 Q 75 59 38 59 H 20 Z'
        fill='currentColor'
      />
    </svg>
  )
}

export default Logo
