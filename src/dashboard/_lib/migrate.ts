import { isFiniteNumber, isRecord } from '@/lib/guards'
import { err, ok, type Result } from '@/lib/result'

import { CONFIG_SCHEMA_VERSION, OLDEST_SUPPORTED_SCHEMA_VERSION } from '../_constants'
import type { ConfigError } from '../_types'
import { migrateV1ToV2 } from './migrations/v1-to-v2'

/**
 * Migrations are pure, idempotent and chained by version. Each one takes unknown input,
 * because it runs before validation, and returns unknown output for the next step to check.
 */
type Migration = {
  from: number
  to: number
  migrate: (input: unknown) => unknown
}

const MIGRATIONS: readonly Migration[] = [{ from: 1, to: 2, migrate: migrateV1ToV2 }]

export type MigrationOutcome = {
  value: unknown
  /** The version the configuration arrived as, or null when no migration was needed. */
  migratedFrom: number | null
}

function failure(code: ConfigError['code'], message: string): ConfigError {
  return { code, message, issues: [] }
}

export function readSchemaVersion(value: unknown): Result<number, ConfigError> {
  if (!isRecord(value)) {
    return err(failure('not-an-object', 'configuration must be a JSON object'))
  }

  const version = value.schemaVersion

  if (!isFiniteNumber(version) || !Number.isInteger(version) || version < 1) {
    return err(
      failure(
        'missing-schema-version',
        'schemaVersion must be a positive whole number, so the format can be identified',
      ),
    )
  }

  return ok(version)
}

export function migrateToCurrent(value: unknown): Result<MigrationOutcome, ConfigError> {
  const startVersion = readSchemaVersion(value)
  if (!startVersion.ok) return startVersion

  const from = startVersion.data

  if (from < OLDEST_SUPPORTED_SCHEMA_VERSION) {
    return err(
      failure(
        'schema-version-too-old',
        `schemaVersion ${from} is older than the oldest supported version ${OLDEST_SUPPORTED_SCHEMA_VERSION}`,
      ),
    )
  }

  if (from > CONFIG_SCHEMA_VERSION) {
    return err(
      failure(
        'migration-failed',
        `schemaVersion ${from} is newer than the supported version ${CONFIG_SCHEMA_VERSION}`,
      ),
    )
  }

  let current = value
  let version = from
  let steps = 0

  while (version < CONFIG_SCHEMA_VERSION) {
    const migration = MIGRATIONS.find((candidate) => candidate.from === version)

    if (!migration) {
      return err(failure('migration-failed', `no migration from schemaVersion ${version}`))
    }

    current = migration.migrate(current)
    const reached = readSchemaVersion(current)

    if (!reached.ok) {
      return err(
        failure(
          'migration-failed',
          `the migration from schemaVersion ${version} produced a configuration with no usable schemaVersion`,
        ),
      )
    }

    if (reached.data <= version) {
      return err(
        failure(
          'migration-failed',
          `the migration from schemaVersion ${version} did not advance the version`,
        ),
      )
    }

    version = reached.data
    steps += 1

    if (steps > MIGRATIONS.length) {
      return err(failure('migration-failed', 'the migration chain did not terminate'))
    }
  }

  return ok({ value: current, migratedFrom: from === CONFIG_SCHEMA_VERSION ? null : from })
}
