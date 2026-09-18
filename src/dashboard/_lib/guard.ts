import { isRecord } from '@/lib/guards'
import { err, ok, type Result } from '@/lib/result'

import { CONFIG_LIMITS, FORBIDDEN_KEYS } from '../_constants'
import type { ConfigError } from '../_types'

/**
 * Cheap structural checks that run before validation. They bound the cost of rejecting a
 * configuration: zod should never be handed a megabyte of nested arrays to walk.
 */

function failure(code: ConfigError['code'], message: string, path?: string): ConfigError {
  return { code, message, issues: path === undefined ? [] : [{ path, message }] }
}

export function guardRawText(rawText: string): Result<string, ConfigError> {
  const bytes = new TextEncoder().encode(rawText).byteLength

  if (bytes > CONFIG_LIMITS.MAX_BYTES) {
    return err(
      failure(
        'too-large',
        `configuration is ${bytes} bytes, the limit is ${CONFIG_LIMITS.MAX_BYTES}`,
      ),
    )
  }

  return ok(rawText)
}

type Entry = { value: unknown; depth: number; path: string }

/**
 * Walks the parsed JSON iteratively: depth, reserved keys and widget count. Recursion would
 * make the walk itself a way to crash the renderer with a deep enough document.
 */
export function guardShape(value: unknown): Result<unknown, ConfigError> {
  if (!isRecord(value)) {
    return err(failure('not-an-object', 'configuration must be a JSON object'))
  }

  const widgets = value.widgets
  if (Array.isArray(widgets) && widgets.length > CONFIG_LIMITS.MAX_WIDGETS) {
    return err(
      failure(
        'too-many-widgets',
        `configuration has ${widgets.length} widgets, the limit is ${CONFIG_LIMITS.MAX_WIDGETS}`,
        'widgets',
      ),
    )
  }

  const stack: Entry[] = [{ value, depth: 1, path: '' }]

  while (stack.length > 0) {
    const entry = stack.pop()
    if (!entry) break

    if (entry.depth > CONFIG_LIMITS.MAX_DEPTH) {
      return err(
        failure(
          'too-deep',
          `configuration nests deeper than ${CONFIG_LIMITS.MAX_DEPTH} levels`,
          entry.path,
        ),
      )
    }

    if (Array.isArray(entry.value)) {
      entry.value.forEach((item, index) => {
        stack.push({ value: item, depth: entry.depth + 1, path: `${entry.path}[${index}]` })
      })
      continue
    }

    if (!isRecord(entry.value)) continue

    for (const key of Object.getOwnPropertyNames(entry.value)) {
      const path = entry.path === '' ? key : `${entry.path}.${key}`

      if (FORBIDDEN_KEYS.some((forbidden) => forbidden === key)) {
        return err(failure('forbidden-key', `reserved key "${key}" is not allowed`, path))
      }

      stack.push({ value: entry.value[key], depth: entry.depth + 1, path })
    }
  }

  return ok(value)
}
