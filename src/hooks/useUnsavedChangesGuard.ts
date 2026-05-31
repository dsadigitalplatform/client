'use client'

import { useEffect, useRef } from 'react'

type Options = {
  isDirty: boolean
  enabled?: boolean
  onNavigateAttempt: (proceed: () => void) => void
}

export function useUnsavedChangesGuard({ isDirty, enabled = true, onNavigateAttempt }: Options) {
  const isDirtyRef = useRef(isDirty)
  const onNavigateAttemptRef = useRef(onNavigateAttempt)

  isDirtyRef.current = isDirty
  onNavigateAttemptRef.current = onNavigateAttempt

  useEffect(() => {
    if (!enabled || !isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled, isDirty])

  useEffect(() => {
    if (!enabled || !isDirty) return

    const handleDocumentClick = (event: MouseEvent) => {
      if (!isDirtyRef.current) return
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null

      if (!anchor) return
      if (anchor.target === '_blank') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')

      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return

      let url: URL

      try {
        url = new URL(href, window.location.href)
      } catch {
        return
      }

      if (url.origin !== window.location.origin) return

      const current = new URL(window.location.href)

      if (url.pathname === current.pathname && url.search === current.search) return

      event.preventDefault()
      event.stopPropagation()

      onNavigateAttemptRef.current(() => {
        window.location.assign(url.href)
      })
    }

    document.addEventListener('click', handleDocumentClick, true)

    return () => document.removeEventListener('click', handleDocumentClick, true)
  }, [enabled, isDirty])
}
