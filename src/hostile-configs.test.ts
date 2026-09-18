import { describe, expect, it } from 'vitest'

import { loadDashboardConfig } from '@/dashboard/_lib/load-config'
import {
  HOSTILE_CONFIGS,
  HOSTILE_MANIFEST_TEXT,
  HOSTILE_README_TEXT,
} from '@/hostile/_lib/hostile-configs'
import { manifestSchema, type ManifestEntry } from '@/hostile/_lib/manifest.schema'

/**
 * The hostile corpus, run. Every file in hostile-configs/ is loaded through the same entry point
 * the app uses, and checked against the manifest that describes what it is meant to do. A file
 * that is not in the manifest fails the run, and so does a manifest entry with no file, because
 * a corpus nobody keeps current stops being evidence of anything.
 */
const manifest = manifestSchema.parse(JSON.parse(HOSTILE_MANIFEST_TEXT))
const entriesByFile = new Map<string, ManifestEntry>(
  manifest.files.map((entry) => [entry.file, entry]),
)

describe('hostile configurations', () => {
  it('has a manifest entry and a README line for every file, and a file for every entry', () => {
    const names = HOSTILE_CONFIGS.map((file) => file.name).sort()
    const described = manifest.files.map((entry) => entry.file).sort()

    expect(names).toEqual(described)

    for (const name of names) {
      expect(HOSTILE_README_TEXT, `${name} is missing from the README`).toContain(name)
    }
  })

  it.each(HOSTILE_CONFIGS.map((file) => [file.name, file.text] as const))(
    '%s behaves as the manifest says',
    (name, text) => {
      const entry = entriesByFile.get(name)
      if (!entry) throw new Error(`${name} is not described in the manifest`)

      // Nothing in the corpus may throw: every failure has to arrive as a rendered outcome.
      const load = (() => {
        try {
          return loadDashboardConfig(text)
        } catch (error) {
          throw new Error(`${name} threw instead of failing visibly`, { cause: error })
        }
      })()

      switch (entry.expect.outcome) {
        case 'dashboard-error': {
          expect(load.kind).toBe('invalid')
          if (load.kind !== 'invalid') return
          expect(load.error.code).toBe(entry.expect.code)
          expect(load.error.message.length).toBeGreaterThan(0)
          expect(load.rawText).toBe(text)
          return
        }

        case 'unsupported-version': {
          expect(load.kind).toBe('unsupported-version')
          if (load.kind !== 'unsupported-version') return
          expect(load.found).toBe(entry.expect.found)
          expect(load.rawText).toBe(text)
          return
        }

        case 'loads': {
          expect(load.kind).toBe('loaded')
          if (load.kind !== 'loaded') return
          expect(load.migratedFrom).toBe(entry.expect.migratedFrom)
          expect(load.filters).toHaveLength(entry.expect.filters)
          expect(load.droppedFilters).toHaveLength(entry.expect.droppedFilters)
          expect(load.slots.map((slot) => slot.kind)).toEqual(entry.expect.widgets)
        }
      }
    },
  )

  it('leaves the prototype alone after loading every one of them', () => {
    for (const file of HOSTILE_CONFIGS) loadDashboardConfig(file.text)

    const probe: Record<string, unknown> = {}
    expect(probe.polluted).toBeUndefined()
    expect(Object.prototype).not.toHaveProperty('polluted')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
