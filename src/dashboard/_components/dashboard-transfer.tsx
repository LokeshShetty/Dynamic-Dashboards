import { useRef } from 'react'

import { Download, FileJson, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

import sampleConfig from '../_fixtures/sample-import.json?raw'
import { loadDashboardConfig } from '../_lib/load-config'

type Props = {
  dashboardId: string
  config: string
  onImported: () => void
}

/**
 * Export writes out exactly what is stored. Import treats the file as hostile input: it goes
 * through the same loader as anything else and lands as a draft to review, never straight into
 * storage, so a file from somewhere else cannot overwrite a dashboard without being looked at.
 *
 * The sample exists so import can be tried without first having to write a configuration by
 * hand, or having to guess the format from the documentation.
 */
export function DashboardTransfer({ dashboardId, config, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const pushToast = useAppStore((state) => state.pushToast)
  const replaceDraft = useAppStore((state) => state.replaceDraft)

  const download = (text: string, filename: string) => {
    const blob = new Blob([text], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const importConfig = async (file: File) => {
    const text = await file.text()
    const load = loadDashboardConfig(text)

    if (load.kind !== 'loaded') {
      pushToast({
        tone: 'error',
        title: 'That file could not be opened',
        description:
          load.kind === 'invalid'
            ? load.error.message
            : `it is written in configuration format ${load.found}, and this build understands ${load.supported}`,
      })
      return
    }

    replaceDraft(dashboardId, load.shell)
    pushToast({
      tone: 'info',
      title: 'Imported as an unsaved draft',
      description: 'Review it, then save it like any other change.',
    })
    onImported()
  }

  return (
    <span className="flex items-center gap-1">
      <Button size="sm" onClick={() => download(config, `${dashboardId}.json`)}>
        <Download aria-hidden="true" className="size-3" />
        Export
      </Button>

      <Button size="sm" onClick={() => fileRef.current?.click()}>
        <Upload aria-hidden="true" className="size-3" />
        Import
      </Button>

      <Button
        size="sm"
        title="A small valid configuration you can import and edit"
        onClick={() => download(sampleConfig, 'sample-dashboard.json')}
      >
        <FileJson aria-hidden="true" className="size-3" />
        Sample
      </Button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Import a dashboard configuration"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importConfig(file)
        }}
      />
    </span>
  )
}
