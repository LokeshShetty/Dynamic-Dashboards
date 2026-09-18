import type { DataFilter } from '@/data/_types'

import { slotToWidgetState } from '../_lib/widget-state'
import type { WidgetSlot } from '../_types'
import { WidgetFrame } from './widget-frame'
import { ChartWidgetTile } from './widgets/chart-widget'
import { MetricWidgetTile } from './widgets/metric-widget'
import { TableWidgetTile } from './widgets/table-widget'
import { TextWidgetTile } from './widgets/text-widget'

type Props = {
  dashboardId: string
  dataset: string
  slot: WidgetSlot
  /** The entry exactly as it was written, so a broken tile can still show its own source. */
  rawEntry: unknown
  filters: DataFilter[]
}

/** Picks the body for a slot. Every branch ends in a frame, including the ones that failed. */
export function WidgetRenderer({ dashboardId, dataset, slot, rawEntry, filters }: Props) {
  const invalidState = slotToWidgetState(slot)

  if (invalidState) {
    return (
      <WidgetFrame
        title={titleForBrokenSlot(slot)}
        widgetId={`slot-${slot.index}`}
        state={invalidState}
        skeleton={null}
        configText={safeJson(rawEntry)}
        onRefresh={() => undefined}
      >
        {() => null}
      </WidgetFrame>
    )
  }

  if (slot.kind !== 'valid') return null

  switch (slot.widget.kind) {
    case 'metric':
      return (
        <MetricWidgetTile
          dashboardId={dashboardId}
          dataset={dataset}
          widget={slot.widget}
          filters={filters}
        />
      )

    case 'table':
      return (
        <TableWidgetTile
          dashboardId={dashboardId}
          dataset={dataset}
          widget={slot.widget}
          filters={filters}
        />
      )

    case 'chart':
      return (
        <ChartWidgetTile
          dashboardId={dashboardId}
          dataset={dataset}
          widget={slot.widget}
          filters={filters}
        />
      )

    case 'text':
      return <TextWidgetTile widget={slot.widget} />
  }
}

function titleForBrokenSlot(slot: WidgetSlot) {
  if (slot.kind === 'invalid') return slot.id ?? `Widget ${slot.index + 1}`
  if (slot.kind === 'valid') return slot.widget.title
  return slot.id
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return 'this widget entry could not even be printed'
  }
}
