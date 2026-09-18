import { Button } from './button'
import { Dialog } from './dialog'

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  tone?: 'default' | 'danger'
  isPending?: boolean
}

/** Destructive actions go through here, never straight off a button. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onCancel,
  tone = 'danger',
  isPending = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'solid'}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </>
      }
    />
  )
}
