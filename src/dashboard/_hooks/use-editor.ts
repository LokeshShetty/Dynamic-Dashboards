import { useCallback, useMemo, useState } from 'react'

import { isRecord } from '@/lib/guards'
import { useAppStore } from '@/lib/store'
import { isDraftDirty } from '@/lib/store/slices/draft.slice'

import type { WidgetKind } from '../_constants'
import type { DashboardShell } from '../_lib/config.schema'
import {
  checkPlacement,
  clampResize,
  findFreeSlot,
  nextPlacement,
  placementsOf,
  swapCandidate,
  type PlacementRefusal,
  type Rect,
} from '../_lib/layout'
import { defaultSizeFor, newWidgetEntry } from '../_lib/widget-defaults'

/**
 * Actions are addressed by position in the widgets array rather than by id, because an entry
 * broken enough to have no usable id still has to be editable and removable.
 */
export type EditorApi = {
  shell: DashboardShell | null
  isDirty: boolean
  /**
   * What just happened to a tile, for a polite live region. A pointer drag shows its own result
   * on screen; a key press has nothing to show, so it says it instead, including the press that
   * did nothing because the tile is against the edge of the grid.
   */
  announcement: string
  addWidget: (kind: WidgetKind) => number | null
  updateWidget: (index: number, entry: unknown) => void
  renameWidget: (index: number, title: string) => void
  duplicateWidget: (index: number) => void
  removeWidget: (index: number) => void
  moveWidget: (index: number, dx: number, dy: number) => void
  resizeWidget: (index: number, dw: number, dh: number) => void
  /** Applies a whole arrangement, as a drag or a resize leaves it. */
  applyLayouts: (layouts: ReadonlyArray<{ index: number; rect: Rect }>) => void
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

  const [announcement, setAnnouncement] = useState('')

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

  const reportRefusal = useCallback(
    (action: string, title: string, refusal: PlacementRefusal) => {
      // Running into the edge of the grid is not a failure, it is the edge: it interrupts nobody
      // with a toast, and it is announced, because a key press that changes nothing on screen
      // tells a screen reader user nothing at all.
      if (refusal.kind === 'overlap') {
        const blocker = titleOf(refusal.withId)
        refuse(action, `every place in that direction is taken, starting with “${blocker}”`)
        setAnnouncement(`${title} cannot move that way, ${blocker} is in the way`)
        return
      }

      setAnnouncement(`${title}: ${refusal.message}`)
    },
    [refuse, titleOf],
  )

  const announcePlacement = useCallback((title: string, rect: Rect) => {
    setAnnouncement(
      `${title} is at column ${rect.x + 1}, row ${rect.y + 1}, ${rect.w} wide by ${rect.h} tall`,
    )
  }, [])

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
    announcement,

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

        const id = readId(entry) ?? `position-${index}`
        const placements = placementsOf(entries)

        // Two tiles of the same size trade places, which is what a full row of metrics needs.
        const swap = swapCandidate(placements, id, rect, { x: dx, y: dy }, columns)

        if (swap) {
          const theirRect = swap.rect
          setAnnouncement(`${titleOf(id)} swapped places with ${titleOf(swap.id)}`)
          setDraftWidgets(
            entries.map((candidate, at) => {
              if (!isRecord(candidate)) return candidate
              if (at === index) return { ...candidate, layout: theirRect }
              if (readId(candidate) === swap.id) return { ...candidate, layout: rect }
              return candidate
            }),
          )
          return
        }

        const outcome = nextPlacement(placements, id, rect, { x: dx, y: dy }, columns)

        if ('refusal' in outcome) {
          reportRefusal('Move', titleOf(id), outcome.refusal)
          return
        }

        announcePlacement(titleOf(id), outcome.rect)
        replace(index, (current) => ({ ...current, layout: outcome.rect }))
      },
      [announcePlacement, columns, entries, reportRefusal, replace, setDraftWidgets, titleOf],
    ),

    applyLayouts: useCallback(
      (layouts) => {
        const byIndex = new Map(layouts.map((entry) => [entry.index, entry.rect]))

        const next = entries.map((entry, at) => {
          const rect = byIndex.get(at)
          if (!rect || !isRecord(entry)) return entry
          return { ...entry, layout: rect }
        })

        // The grid moved the tiles; whether the arrangement is allowed is still decided here.
        const placements = placementsOf(next)
        const invalid = placements.find(
          (placement) => checkPlacement(placements, placement.id, placement.rect, columns) !== null,
        )

        if (invalid) return
        if (JSON.stringify(next) === JSON.stringify(entries)) return

        setDraftWidgets(next)
      },
      [columns, entries, setDraftWidgets],
    ),

    resizeWidget: useCallback(
      (index, dw, dh) => {
        const entry = entries[index]
        const rect = isRecord(entry) ? readRect(entry) : null
        if (!rect) return

        const id = readId(entry) ?? `position-${index}`
        const outcome = clampResize(placementsOf(entries), id, rect, { w: dw, h: dh }, columns)

        if ('refusal' in outcome) {
          reportRefusal('Resize', titleOf(id), outcome.refusal)
          return
        }

        announcePlacement(titleOf(id), outcome.rect)
        replace(index, (current) => ({ ...current, layout: outcome.rect }))
      },
      [announcePlacement, columns, entries, reportRefusal, replace, titleOf],
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
