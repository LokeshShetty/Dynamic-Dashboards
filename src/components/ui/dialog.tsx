import { useEffect, useId, useRef, type ReactNode } from 'react'

import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

import { Button } from './button'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  className?: string
}

/**
 * A modal over the native dialog element. showModal brings the parts that are easy to get
 * wrong by hand: the top layer, the inert background, focus kept inside, and Escape. What the
 * element does not do, this adds: closing on a backdrop click, restoring focus to whatever
 * opened it, locking the page behind it, and naming itself for assistive technology.
 */
export function Dialog({ open, onClose, title, description, children, footer, className }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<Element | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
      return
    }

    if (!open && dialog.open) dialog.close()
  }, [open])

  // The backdrop is the dialog element itself, so the listener goes on the element rather than
  // on a JSX handler: it is a pointer shortcut for Escape, which the element already handles.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    const onClick = (event: MouseEvent) => {
      if (event.target === dialog) dialog.close()
    }

    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (!open) return

    const body = document.body
    const previousOverflow = body.style.overflow
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
    }
  }, [open])

  // Escape and the close button both end here, and focus goes back where it came from.
  const handleClose = () => {
    const opener = openerRef.current
    openerRef.current = null
    if (opener instanceof HTMLElement) opener.focus()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onClose={handleClose}
      className={cn(
        'bg-surface-raised text-fg border-border m-auto w-[min(40rem,calc(100vw-2rem))] rounded-lg border p-0 shadow-xl backdrop:bg-black/50',
        className,
      )}
    >
      <div className="flex max-h-[80vh] flex-col">
        <header className="border-border flex items-start justify-between gap-3 border-b p-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-fg text-base font-semibold">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="text-fg-muted text-sm">
                {description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Close ${title}`}
            onClick={() => dialogRef.current?.close()}
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </header>

        {children === undefined ? null : (
          <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
        )}

        {footer === undefined ? null : (
          <footer className="border-border flex justify-end gap-2 border-t p-4">{footer}</footer>
        )}
      </div>
    </dialog>
  )
}
