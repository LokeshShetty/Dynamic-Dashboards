import { Bug, X } from 'lucide-react'

import { Button } from '@/components/ui/button'

type Props = {
  file: string
  attacks: string | null
  onClose: () => void
}

export function HostileBanner({ file, attacks, onClose }: Props) {
  return (
    <output
      aria-label="Hostile configuration"
      className="border-danger bg-danger-surface text-fg flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
    >
      <span className="inline-flex items-center gap-2">
        <Bug aria-hidden="true" className="size-4" />
        Rendering the hostile file <code className="text-fg">{file}</code>. It is not saved and
        cannot be edited from here.
        {attacks === null ? null : ` It attacks ${attacks}.`}
      </span>

      <Button size="sm" className="ml-auto" onClick={onClose}>
        <X aria-hidden="true" className="size-3" />
        Back to the stored dashboard
      </Button>
    </output>
  )
}
