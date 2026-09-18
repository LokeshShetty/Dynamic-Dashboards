import type { StateCreator } from 'zustand'

import type { DashboardShell } from '@/dashboard/_lib/config.schema'

/**
 * The dashboard being edited. It holds widget entries exactly as they will be saved, including
 * entries that are not valid yet, so the editor previews a configuration through the same
 * loader the reader gets rather than through a second, kinder path.
 *
 * Nothing here touches the loaded configuration. Until save exists, closing edit mode throws
 * the draft away, which is why leaving with unsaved work asks first.
 */
export type Draft = {
  dashboardId: string
  shell: DashboardShell
}

export type DraftSlice = {
  draft: Draft | null
  /** The draft as it was when editing started, for the dirty check and for discard. */
  draftBaseline: DashboardShell | null
  startDraft: (dashboardId: string, shell: DashboardShell) => void
  discardDraft: () => void
  resetDraft: () => void
  setDraftWidgets: (widgets: unknown[]) => void
}

export const createDraftSlice: StateCreator<DraftSlice> = (set, get) => ({
  draft: null,
  draftBaseline: null,

  startDraft: (dashboardId, shell) => {
    const current = get().draft
    if (current?.dashboardId === dashboardId) return

    set({ draft: { dashboardId, shell }, draftBaseline: shell })
  },

  discardDraft: () => set({ draft: null, draftBaseline: null }),

  resetDraft: () =>
    set((state) =>
      state.draft === null || state.draftBaseline === null
        ? state
        : { draft: { ...state.draft, shell: state.draftBaseline } },
    ),

  setDraftWidgets: (widgets) =>
    set((state) =>
      state.draft === null
        ? state
        : { draft: { ...state.draft, shell: { ...state.draft.shell, widgets } } },
    ),
})

export function isDraftDirty(draft: Draft | null, baseline: DashboardShell | null) {
  if (!draft || baseline === null) return false
  return JSON.stringify(draft.shell) !== JSON.stringify(baseline)
}
