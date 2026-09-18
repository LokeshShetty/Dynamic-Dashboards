import { createParser, useQueryState } from 'nuqs'

import { findHostileConfig } from '../_lib/hostile-configs'

/** Which hostile file is being looked at: /d/demo?hostile=duplicate-ids.json */
const parseHostileFile = createParser({
  parse: (raw) => (findHostileConfig(raw) === null ? null : raw),
  serialize: (value: string) => value,
})

export function useHostileParam() {
  const [file, setFile] = useQueryState(
    'hostile',
    parseHostileFile.withOptions({ history: 'push' }),
  )

  return {
    file,
    open: (name: string) => {
      void setFile(name)
    },
    close: () => {
      void setFile(null)
    },
  }
}
