import { useCallback, useMemo } from 'react'

import { isRecord } from '@/lib/guards'
import { useAppStore } from '@/lib/store'
import { isDraftDirty } from '@/lib/store/slices/draft.slice'

import type { WidgetKind } from '../_constants'
import type { DashboardShell } from '../_lib/config.schema'
import { checkPlacement, findFreeSlot, placementsOf, type Rect } from '../_lib/layout'
import { defaultSizeFor, newWidgetEntry } from '../_lib/widget-defaults'

/**
 * Actions are addressed by position in the widgets array rather than by id, because an entry
 * broken enough to have no usable id still has to be editable and removable.
 */
export type EditorApi = {
  shell: DashboardShell | null
  isDirty: boolean
  addWidget: (kind: WidgetKind) => number | null
  updateWidget: (index: number, entry: unknown) => void
  renameWidget: (index: number, title: string) => void
  duplicateWidget: (index: number) => void
  removeWidget: (index: number) => void
  moveWidget: (index: number, dx: number, dy: number) => void
  resizeWidget: (index: number, dw: number, dh: number) => void
}

/**
 * Every change the editor can make, applied to the draft and nowhere else. Layout changes are
 * checked against the same rules the loader uses before they are applied, so the editor cannot
 * put the dashboard into a state it would then report as invalid. A refused change says why.
 */
export function useEditor(): EditorApi {
  const draft = useAppStore((state) => state.draft)
  const baseline = useAppStore((state) => state.draftBaseline)
  const setDraftWidgets = useAppStore((state) => state.setDraftWidgets)
  const pushToast = useAppStore((state) => state.pushToast)

  const shell = draft?.shell ?? null
  const entries = useMemo(() => shell?.widgets ?? [], [shell])
  const columns = shell?.layout.columns ?? 12

  const refuse = useCallback(
    (action: string, reason: string) => {
      pushToast({ tone: 'info', title: `${action} refused`, description: reason })
    },
    [pushToast],
  )

  const titleOf = useCallback(
    (id: string) => {
      const entry = entries.find((candidate) => readId(candidate) === id)
      return isRecord(entry) && typeof entry.title === 'string' ? entry.title : id
    },
    [entries],
  )

  const place = useCallback(
    (id: string, rect: Rect, action: string) => {
      const refusal = checkPlacement(placementsOf(entries), id, rect, columns)
      if (!refusal) return true

      refuse(
        action,
        refusal.kind === 'overlap'
          ? `that would sit on top of “${titleOf(refusal.withId)}”`
          : refusal.message,
      )
      return false
    },
    [columns, entries, refuse, titleOf],
  )

  const addWidget = useCallback(
    (kind: WidgetKind) => {
      if (!shell) return null

      const size = defaultSizeFor(kind)
      const rect = findFreeSlot(placementsOf(entries), size, columns)

      if (!rect) {
        refuse('Adding a widget', 'there is no free space left on the grid for it')
        return null
      }

      const id = uniqueId(kind, entries)
      setDraftWidgets([...entries, newWidgetEntry(kind, id, rect)])
      return entries.length
    },
    [columns, entries, refuse, setDraftWidgets, shell],
  )

  const replace = useCallback(
    (index: number, next: (entry: Record<string, unknown>) => unknown) => {
      setDraftWidgets(
        entries.map((entry, at) => (at === index && isRecord(entry) ? next(entry) : entry)),
      )
    },
    [entries, setDraftWidgets],
  )

  return {
    shell,
    isDirty: isDraftDirty(draft, baseline),

    addWidget,

    updateWidget: useCallback(
      (index, entry) => {
        // The live form fires on every keystroke, including ones that changed nothing.
        if (JSON.stringify(entries[index]) === JSON.stringify(entry)) return

        setDraftWidgets(entries.map((candidate, at) => (at === index ? entry : candidate)))
      },
      [entries, setDraftWidgets],
    ),

    renameWidget: useCallback(
      (index, title) => replace(index, (entry) => ({ ...entry, title })),
      [replace],
    ),

    duplicateWidget: useCallback(
      (index) => {
        const source = entries[index]
        if (!isRecord(source)) return

        const rect = readRect(source)
        const size = rect ?? { w: 3, h: 1 }
        const slot = findFreeSlot(placementsOf(entries), { w: size.w, h: size.h }, columns)

        if (!slot) {
          refuse('Duplicating', 'there is no free space left on the grid for a copy')
          return
        }

        setDraftWidgets([
          ...entries,
          { ...source, id: uniqueId(readKind(source), entries), layout: slot },
        ])
      },
      [columns, entries, refuse, setDraftWidgets],
    ),

    removeWidget: useCallback(
      (index) => setDraftWidgets(entries.filter((_entry, at) => at !== index)),
      [entries, setDraftWidgets],
    ),

    moveWidget: useCallback(
      (index, dx, dy) => {
        const entry = entries[index]
        const rect = isRecord(entry) ? readRect(entry) : null
        if (!rect) return

        const next = { ...rect, x: rect.x + dx, y: rect.y + dy }
        const id = readId(entry) ?? `position-${index}`
        if (place(id, next, 'Move')) replace(index, (current) => ({ ...current, layout: next }))
      },
      [entries, place, replace],
    ),

    resizeWidget: useCallback(
      (index, dw, dh) => {
        const entry = entries[index]
        const rect = isRecord(entry) ? readRect(entry) : null
        if (!rect) return

        const next = { ...rect, w: rect.w + dw, h: rect.h + dh }
        const id = readId(entry) ?? `position-${index}`
        if (place(id, next, 'Resize')) replace(index, (current) => ({ ...current, layout: next }))
      },
      [entries, place, replace],
    ),
  }
}

function readId(entry: unknown): string | null {
  return isRecord(entry) && typeof entry.id === 'string' ? entry.id : null
}

function readKind(entry: unknown): string {
  return isRecord(entry) && typeof entry.kind === 'string' ? entry.kind : 'widget'
}

function readRect(entry: Record<string, unknown>): Rect | null {
  const layout = entry.layout
  if (!isRecord(layout)) return null

  const { x, y, w, h } = layout
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number'
  ) {
    return null
  }

  return { x, y, w, h }
}

function uniqueId(prefix: string, entries: ReadonlyArray<unknown>) {
  const taken = new Set(entries.map(readId))
  let index = 1
  while (taken.has(`${prefix}-${index}`)) index += 1
  return `${prefix}-${index}`
}
