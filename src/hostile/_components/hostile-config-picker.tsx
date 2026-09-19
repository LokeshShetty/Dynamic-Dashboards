import { useId } from 'react'

import { Bug } from 'lucide-react'

import { CONTROL_CLASS } from '@/constants/ui'

import { useHostileParam } from '../_hooks/use-hostile-param'
import { HOSTILE_CONFIG_NAMES } from '../_lib/hostile-configs'

/**
 * Opens one of the files in hostile-configs/ in place of the stored dashboard. The picker reads
 * the same files the test runner does, so what a reviewer sees here is what the runner asserts.
 */
export function HostileConfigPicker() {
  const controlId = useId()
  const { file, open, close } = useHostileParam()

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={controlId} className="text-fg-muted inline-flex items-center gap-1 text-xs">
        <Bug aria-hidden="true" className="size-3" />
        Load a hostile configuration
      </label>
      <select
        id={controlId}
        className={CONTROL_CLASS}
        value={file ?? ''}
        onChange={(event) => (event.target.value === '' ? close() : open(event.target.value))}
      >
        <option value="">The stored dashboard</option>
        {HOSTILE_CONFIG_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}
