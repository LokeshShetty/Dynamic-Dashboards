import { isRecord } from '@/lib/guards'

/**
 * What changed between the saved dashboard and the one being edited, per widget. A conflict is
 * not a merge: this is here so a reader can see what they would lose either way before choosing.
 */
export type WidgetChange = {
  id: string
  title: string
  change: 'only-theirs' | 'only-mine' | 'different'
}

export type ConfigDiff = {
  widgets: WidgetChange[]
  settingsDiffer: boolean
}

export function diffConfigs(theirs: string, mine: string): ConfigDiff {
  const theirWidgets = widgetsOf(theirs)
  const myWidgets = widgetsOf(mine)
  const ids = [...new Set([...theirWidgets.keys(), ...myWidgets.keys()])].sort()

  const widgets = ids.flatMap<WidgetChange>((id) => {
    const their = theirWidgets.get(id)
    const my = myWidgets.get(id)

    if (their === undefined && my !== undefined) {
      return [{ id, title: titleOf(my, id), change: 'only-mine' }]
    }

    if (my === undefined && their !== undefined) {
      return [{ id, title: titleOf(their, id), change: 'only-theirs' }]
    }

    if (their !== undefined && my !== undefined && their !== my) {
      return [{ id, title: titleOf(my, id), change: 'different' }]
    }

    return []
  })

  return { widgets, settingsDiffer: settingsOf(theirs) !== settingsOf(mine) }
}

function widgetsOf(config: string): Map<string, string> {
  const parsed = parse(config)
  const widgets = isRecord(parsed) && Array.isArray(parsed.widgets) ? parsed.widgets : []

  const byId = new Map<string, string>()

  widgets.forEach((widget, index) => {
    const id =
      isRecord(widget) && typeof widget.id === 'string' ? widget.id : `position ${index + 1}`
    byId.set(id, JSON.stringify(widget))
  })

  return byId
}

/** Everything except the widgets: title, filters, dataset, layout. */
function settingsOf(config: string): string {
  const parsed = parse(config)
  if (!isRecord(parsed)) return config

  const { widgets: _widgets, version: _version, updatedAt: _updatedAt, ...settings } = parsed
  return JSON.stringify(settings)
}

function titleOf(widgetJson: string, fallback: string): string {
  const parsed = parse(widgetJson)
  return isRecord(parsed) && typeof parsed.title === 'string' ? parsed.title : fallback
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
