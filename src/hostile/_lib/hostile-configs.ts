/**
 * The hostile corpus, read straight from hostile-configs/ at the repo root. The test runner and
 * the app both import this, so there is exactly one copy of every file: a fixture that drifts
 * from what the app loads would be worse than no fixture at all.
 */
const rawFiles = import.meta.glob('/hostile-configs/*.{json,txt}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const rawManifest = import.meta.glob('/hostile-configs/manifest.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const rawReadme = import.meta.glob('/hostile-configs/README.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})

export type HostileConfig = { name: string; text: string }

function nameOf(path: string) {
  return path.slice(path.lastIndexOf('/') + 1)
}

export const HOSTILE_CONFIGS: HostileConfig[] = Object.entries(rawFiles)
  .map(([path, text]) => ({ name: nameOf(path), text: String(text) }))
  .filter((file) => file.name !== 'manifest.json')
  .sort((left, right) => left.name.localeCompare(right.name))

export function findHostileConfig(name: string): HostileConfig | null {
  return HOSTILE_CONFIGS.find((file) => file.name === name) ?? null
}

export const HOSTILE_MANIFEST_TEXT = String(Object.values(rawManifest)[0] ?? '{}')
export const HOSTILE_README_TEXT = String(Object.values(rawReadme)[0] ?? '')
