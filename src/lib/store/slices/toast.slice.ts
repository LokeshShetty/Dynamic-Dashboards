import type { StateCreator } from 'zustand'

export type ToastTone = 'success' | 'error' | 'info'

export type Toast = {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

export type ToastSlice = {
  toasts: Toast[]
  pushToast: (toast: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
}

let nextToastId = 0

/**
 * Toasts are state, not timers: the region that renders them owns the countdown, so hovering
 * a toast can pause it without the store knowing anything about pointers.
 */
export const createToastSlice: StateCreator<ToastSlice> = (set) => ({
  toasts: [],

  pushToast: (toast) => {
    nextToastId += 1
    const id = `toast-${nextToastId}`
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }))
    return id
  },

  dismissToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
})
