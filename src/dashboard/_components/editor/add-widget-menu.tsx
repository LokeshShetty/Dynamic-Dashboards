import { BarChart3, FileText, Hash, Table2 } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { WIDGET_KINDS, type WidgetKind } from '../../_constants'

const ICONS = {
  metric: Hash,
  table: Table2,
  chart: BarChart3,
  text: FileText,
} as const

type Props = { onAdd: (kind: WidgetKind) => void }

/** The catalogue. Four types, done properly, rather than a gallery of half finished ones. */
export function AddWidgetMenu({ onAdd }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-fg-muted text-xs">Add</span>
      {WIDGET_KINDS.map((kind) => {
        const Icon = ICONS[kind]
        return (
          <Button key={kind} size="sm" onClick={() => onAdd(kind)}>
            <Icon aria-hidden="true" className="size-3" />
            {kind}
          </Button>
        )
      })}
    </div>
  )
}
