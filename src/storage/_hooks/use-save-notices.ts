import { useEffect, useState } from 'react'

import { subscribeToSaves } from '../_lib/broadcast'

export type SaveNotice = { version: number; savedAt: string }

/**
 * News from the other tabs. It is only ever news: nothing reloads itself, because the reader may
 * be halfway through an edit and a helpful reload is the one thing that would lose it.
 */
export function useSaveNotices(dashboardId: string) {
  const [notice, setNotice] = useState<SaveNotice | null>(null)
  const [noticeFor, setNoticeFor] = useState(dashboardId)

  // Opening a different dashboard drops the news about the last one, adjusted during render
  // rather than in an effect, so no render ever shows a notice from another dashboard.
  if (noticeFor !== dashboardId) {
    setNoticeFor(dashboardId)
    setNotice(null)
  }

  useEffect(
    () =>
      subscribeToSaves((message) => {
        if (message.dashboardId !== dashboardId) return
        setNotice({ version: message.version, savedAt: message.savedAt })
      }),
    [dashboardId],
  )

  return { notice, dismiss: () => setNotice(null) }
}
