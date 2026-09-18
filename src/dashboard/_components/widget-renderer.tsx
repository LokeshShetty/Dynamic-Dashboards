import { isRecord } from '@/lib/guards'

import { slotToWidgetState } from '../_lib/widget-state'
import type { WidgetFilterContext, WidgetSlot } from '../_types'
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
  filters: WidgetFilterContext
}

/** Picks the body for a slot. Every branch ends in a frame, including the ones that failed. */
export function WidgetRenderer({ dashboardId, dataset, slot, rawEntry, filters }: Props) {
  const invalidState = slotToWidgetState(slot)

  if (invalidState) {
    return (
      <WidgetFrame
        title={titleForBrokenSlot(slot, rawEntry)}
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

  const widgetDataset = slot.widget.dataset ?? dataset

  switch (slot.widget.kind) {
    case 'metric':
      return (
        <MetricWidgetTile
          dashboardId={dashboardId}
          dataset={widgetDataset}
          widget={slot.widget}
          filters={filters}
        />
      )

    case 'table':
      return (
        <TableWidgetTile
          dashboardId={dashboardId}
          dataset={widgetDataset}
          widget={slot.widget}
          filters={filters}
        />
      )

    case 'chart':
      return (
        <ChartWidgetTile
          dashboardId={dashboardId}
          dataset={widgetDataset}
          widget={slot.widget}
          filters={filters}
        />
      )

    case 'text':
      return <TextWidgetTile widget={slot.widget} />
  }
}

/** A broken widget still has a name its author would recognise: its title, then its id. */
function titleForBrokenSlot(slot: WidgetSlot, rawEntry: unknown) {
  if (isRecord(rawEntry) && typeof rawEntry.title === 'string' && rawEntry.title !== '') {
    return rawEntry.title
  }

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
