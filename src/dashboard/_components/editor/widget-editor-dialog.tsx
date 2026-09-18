import { useId } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { isRecord } from '@/lib/guards'

import { ChartForm } from './form/chart-form'
import { MetricForm } from './form/metric-form'
import { TableForm } from './form/table-form'
import { TextForm } from './form/text-form'

type Props = {
  entry: unknown
  dashboardDataset: string
  onChange: (values: unknown) => void
  onClose: () => void
}

/**
 * The edit form, over the same zod schema the loader validates with: there is no second idea of
 * what a valid widget is. Every change reaches the draft as it is typed, so the tile behind the
 * dialog shows the state the reader would get, including the states that say it cannot render.
 *
 * Closing keeps what was typed: the draft is not the saved dashboard, and discarding the whole
 * draft is one button away in the editor bar.
 */
export function WidgetEditorDialog({ entry, dashboardDataset, onChange, onClose }: Props) {
  const formId = useId()
  const kind = isRecord(entry) && typeof entry.kind === 'string' ? entry.kind : ''
  const title = isRecord(entry) && typeof entry.title === 'string' ? entry.title : 'widget'

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Edit ${title}`}
      description="Changes appear on the tile behind this dialog as you make them."
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button type="submit" form={formId} variant="solid">
            Done
          </Button>
        </>
      }
    >
      {kind === 'metric' ? (
        <MetricForm
          entry={entry}
          dashboardDataset={dashboardDataset}
          onChange={onChange}
          formId={formId}
          onSubmit={onClose}
        />
      ) : null}

      {kind === 'table' ? (
        <TableForm
          entry={entry}
          dashboardDataset={dashboardDataset}
          onChange={onChange}
          formId={formId}
          onSubmit={onClose}
        />
      ) : null}

      {kind === 'chart' ? (
        <ChartForm
          entry={entry}
          dashboardDataset={dashboardDataset}
          onChange={onChange}
          formId={formId}
          onSubmit={onClose}
        />
      ) : null}

      {kind === 'text' ? (
        <TextForm entry={entry} onChange={onChange} formId={formId} onSubmit={onClose} />
      ) : null}

      {['metric', 'table', 'chart', 'text'].includes(kind) ? null : (
        <p role="alert" className="text-fg text-sm">
          This entry claims to be a “{kind}” widget, which is not a type this build can edit. Fix
          its kind in the configuration, or remove it.
        </p>
      )}
    </Dialog>
  )
}
