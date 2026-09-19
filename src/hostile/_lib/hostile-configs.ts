/**
 * The hostile corpus, read straight from hostile-configs/ at the repo root. The test runner and
 * the app both import this, so there is exactly one copy of every file: a fixture that drifts
 * from what the app loads would be worse than no fixture at all.
 *
 * The files are loaded on demand rather than eagerly. One of them is a megabyte of widgets whose
 * whole purpose is to be too large to parse, and shipping it inside the application bundle would
 * have meant every reader downloading it to look at a dashboard.
 */
const loaders = import.meta.glob('/hostile-configs/*.{json,txt}', {
  query: '?raw',
  import: 'default',
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

const LOADER_BY_NAME = new Map(
  Object.entries(loaders)
    .map(([path, load]) => [nameOf(path), load] as const)
    .filter(([name]) => name !== 'manifest.json'),
)

/** Every file in the folder, by name. Reading one is a separate request. */
export const HOSTILE_CONFIG_NAMES = [...LOADER_BY_NAME.keys()].sort((left, right) =>
  left.localeCompare(right),
)

export function isHostileConfigName(name: string) {
  return LOADER_BY_NAME.has(name)
}

export async function loadHostileConfig(name: string): Promise<HostileConfig | null> {
  const load = LOADER_BY_NAME.get(name)
  if (!load) return null

  return { name, text: String(await load()) }
}

/** Used by the runner, which does want all of them. */
export async function loadAllHostileConfigs(): Promise<HostileConfig[]> {
  const files = await Promise.all(HOSTILE_CONFIG_NAMES.map((name) => loadHostileConfig(name)))
  return files.filter((file): file is HostileConfig => file !== null)
}

export const HOSTILE_MANIFEST_TEXT = String(Object.values(rawManifest)[0] ?? '{}')
export const HOSTILE_README_TEXT = String(Object.values(rawReadme)[0] ?? '')
