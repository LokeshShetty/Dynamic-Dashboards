import { useEffect, type RefObject } from 'react'

/**
 * Anything that floats over the page closes the way people expect: a click elsewhere, or Escape.
 * Without both, an overlay becomes something to be got rid of rather than used.
 */
export function useDismissOnOutside(
  ref: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) return

    const onPointerDown = (event: PointerEvent) => {
      const element = ref.current
      if (element && event.target instanceof Node && !element.contains(event.target)) onDismiss()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onDismiss, ref])
}
