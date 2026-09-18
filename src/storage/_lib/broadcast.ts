import { log } from '@/lib/log'

import { SAVE_CHANNEL_NAME, STORAGE_KEY_PREFIX } from '../_constants'
import { saveMessageSchema, type SaveMessage } from './storage.schema'

/**
 * Two tabs are two users here. A save tells the other tabs over BroadcastChannel, and where that
 * is missing the storage event carries the same news. Messages are validated like any other
 * input: another tab is not more trustworthy than a URL.
 *
 * No tab ever reloads itself over someone's edits. The news is shown; what to do with it is the
 * reader's decision.
 */
const SENDER_ID = `tab-${Math.random().toString(36).slice(2, 10)}`

let channel: BroadcastChannel | null = null

function getChannel(): BroadcastChannel | null {
  if (channel) return channel
  if (typeof BroadcastChannel === 'undefined') return null

  channel = new BroadcastChannel(SAVE_CHANNEL_NAME)
  return channel
}

export function publishSave(save: { dashboardId: string; version: number; savedAt: string }) {
  const message: SaveMessage = { kind: 'dashboard-saved', sender: SENDER_ID, ...save }
  getChannel()?.postMessage(message)
}

export function subscribeToSaves(listener: (message: SaveMessage) => void): () => void {
  const onMessage = (event: MessageEvent<unknown>) => {
    const parsed = saveMessageSchema.safeParse(event.data)

    if (!parsed.success) {
      log.warn('storage.message.ignored', { reason: parsed.error.issues[0]?.message })
      return
    }

    if (parsed.data.sender === SENDER_ID) return
    listener(parsed.data)
  }

  const broadcast = getChannel()
  broadcast?.addEventListener('message', onMessage)

  // Fallback for contexts without BroadcastChannel: the storage event fires in other tabs only.
  const onStorage = (event: StorageEvent) => {
    if (!event.key?.startsWith(STORAGE_KEY_PREFIX) || event.newValue === null) return

    const id = event.key.slice(STORAGE_KEY_PREFIX.length)

    try {
      const parsed: unknown = JSON.parse(event.newValue)
      const record = saveMessageSchema.safeParse({
        kind: 'dashboard-saved',
        dashboardId: id,
        sender: 'storage-event',
        version:
          typeof parsed === 'object' && parsed !== null && 'version' in parsed
            ? parsed.version
            : -1,
        savedAt:
          typeof parsed === 'object' && parsed !== null && 'savedAt' in parsed
            ? parsed.savedAt
            : '',
      })

      if (record.success) listener(record.data)
    } catch {
      log.warn('storage.event.ignored', { key: event.key })
    }
  }

  window.addEventListener('storage', onStorage)

  return () => {
    broadcast?.removeEventListener('message', onMessage)
    window.removeEventListener('storage', onStorage)
  }
}
