import type { DataRow, DatasetField, DatasetSchema } from '@/types/data'

import { DATASET_ROW_COUNTS, WORLD_ANCHOR_ISO, WORLD_SEED, WORLD_WINDOW_DAYS } from '../_constants'

/**
 * A synthetic claims world. Nothing here describes a real person: parties are organisations,
 * identifiers are sequential, and every value comes from a seeded generator so the same
 * dashboard shows the same numbers on every machine.
 */

/** mulberry32: small, seeded, and good enough for fixtures. */
function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, values: readonly T[], fallback: T): T {
  return values[Math.floor(random() * values.length)] ?? fallback
}

function intBetween(random: () => number, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}

const ANCHOR_MS = Date.parse(WORLD_ANCHOR_ISO)
const DAY_MS = 24 * 60 * 60 * 1000

function dayOffsetIso(days: number, random: () => number) {
  const withinDay = Math.floor(random() * DAY_MS)
  return new Date(ANCHOR_MS - days * DAY_MS + withinDay).toISOString()
}

const PAYERS = ['Meridian Health Plan', 'Cascade Mutual', 'Northwind Care', 'Brightline Benefits']
const CLAIM_STATUSES = ['submitted', 'in_review', 'paid', 'denied', 'appealed']
const PROCEDURE_CODES = ['99213', '99214', '70450', '80053', '93000', '20610', '36415']
const DENIAL_REASONS = ['missing_documentation', 'not_covered', 'duplicate_claim', 'late_filing']
const SPECIALTIES = [
  'family_medicine',
  'cardiology',
  'orthopedics',
  'radiology',
  'behavioral_health',
]
const STATES = ['CA', 'TX', 'NY', 'WA', 'IL', 'GA', 'AZ']
const NETWORK_STATUSES = ['in_network', 'out_of_network', 'pending']
const APPLICATION_STATUSES = [
  'received',
  'primary_source_review',
  'committee',
  'approved',
  'rejected',
]
const REVIEW_QUEUES = ['queue-a', 'queue-b', 'queue-c', 'queue-d']
const ORGANIZATION_PREFIXES = [
  'Northgate',
  'Lakeshore',
  'Summit Ridge',
  'Cedar Park',
  'Harbor Point',
  'Willow Creek',
]
const ORGANIZATION_SUFFIXES = [
  'Family Practice',
  'Medical Group',
  'Health Partners',
  'Clinic',
  'Specialty Care',
]

const CLAIMS_FIELDS: DatasetField[] = [
  { name: 'claim_id', type: 'text', nullable: false },
  { name: 'provider_npi', type: 'text', nullable: false },
  { name: 'payer', type: 'text', nullable: false },
  { name: 'procedure_code', type: 'text', nullable: false },
  { name: 'status', type: 'text', nullable: false },
  { name: 'amount_cents', type: 'number', nullable: false },
  { name: 'line_items', type: 'number', nullable: false },
  { name: 'submitted_at', type: 'date', nullable: false },
  { name: 'paid_at', type: 'date', nullable: true },
  { name: 'denial_reason', type: 'text', nullable: true },
  { name: 'is_resubmission', type: 'boolean', nullable: false },
]

const PROVIDERS_FIELDS: DatasetField[] = [
  { name: 'provider_npi', type: 'text', nullable: false },
  { name: 'organization', type: 'text', nullable: false },
  { name: 'specialty', type: 'text', nullable: false },
  { name: 'state', type: 'text', nullable: false },
  { name: 'network_status', type: 'text', nullable: false },
  { name: 'panel_size', type: 'number', nullable: false },
  { name: 'credentialed_at', type: 'date', nullable: true },
]

const APPLICATIONS_FIELDS: DatasetField[] = [
  { name: 'application_id', type: 'text', nullable: false },
  { name: 'provider_npi', type: 'text', nullable: false },
  { name: 'status', type: 'text', nullable: false },
  { name: 'assigned_queue', type: 'text', nullable: false },
  { name: 'submitted_at', type: 'date', nullable: false },
  { name: 'decided_at', type: 'date', nullable: true },
  { name: 'days_in_queue', type: 'number', nullable: false },
]

export type Dataset = {
  schema: DatasetSchema
  rows: DataRow[]
}

function buildProviders(random: () => number): DataRow[] {
  return Array.from({ length: DATASET_ROW_COUNTS.providers }, (_unused, index) => ({
    provider_npi: `10${String(24680000 + index * 7).padStart(8, '0')}`,
    organization: `${pick(random, ORGANIZATION_PREFIXES, 'Northgate')} ${pick(random, ORGANIZATION_SUFFIXES, 'Clinic')}`,
    specialty: pick(random, SPECIALTIES, 'family_medicine'),
    state: pick(random, STATES, 'CA'),
    network_status: pick(random, NETWORK_STATUSES, 'in_network'),
    panel_size: intBetween(random, 180, 4200),
    credentialed_at: random() < 0.1 ? null : dayOffsetIso(intBetween(random, 90, 900), random),
  }))
}

function buildClaims(random: () => number, npis: string[]): DataRow[] {
  return Array.from({ length: DATASET_ROW_COUNTS.claims }, (_unused, index) => {
    const status = pick(random, CLAIM_STATUSES, 'submitted')
    const submittedDaysAgo = intBetween(random, 0, WORLD_WINDOW_DAYS)

    return {
      claim_id: `CLM-${100000 + index}`,
      provider_npi: pick(random, npis, '1024680000'),
      payer: pick(random, PAYERS, 'Meridian Health Plan'),
      procedure_code: pick(random, PROCEDURE_CODES, '99213'),
      status,
      amount_cents: intBetween(random, 2_400, 890_000),
      line_items: intBetween(random, 1, 6),
      submitted_at: dayOffsetIso(submittedDaysAgo, random),
      paid_at:
        status === 'paid'
          ? dayOffsetIso(Math.max(0, submittedDaysAgo - intBetween(random, 3, 30)), random)
          : null,
      denial_reason: status === 'denied' ? pick(random, DENIAL_REASONS, 'not_covered') : null,
      is_resubmission: random() < 0.18,
    }
  })
}

function buildApplications(random: () => number, npis: string[]): DataRow[] {
  return Array.from({ length: DATASET_ROW_COUNTS.credentialing_applications }, (_unused, index) => {
    const status = pick(random, APPLICATION_STATUSES, 'received')
    const submittedDaysAgo = intBetween(random, 0, WORLD_WINDOW_DAYS)
    const decided = status === 'approved' || status === 'rejected'

    return {
      application_id: `APP-${5000 + index}`,
      provider_npi: pick(random, npis, '1024680000'),
      status,
      assigned_queue: pick(random, REVIEW_QUEUES, 'queue-a'),
      submitted_at: dayOffsetIso(submittedDaysAgo, random),
      decided_at: decided
        ? dayOffsetIso(Math.max(0, submittedDaysAgo - intBetween(random, 2, 40)), random)
        : null,
      days_in_queue: intBetween(random, 1, 120),
    }
  })
}

function toDataset(dataset: string, fields: DatasetField[], rows: DataRow[]): Dataset {
  return { schema: { dataset, fields, rowCount: rows.length }, rows }
}

function buildWorld(): Record<string, Dataset> {
  const random = createRandom(WORLD_SEED)
  const providers = buildProviders(random)
  const npis = providers.map((provider) => String(provider.provider_npi))

  return {
    claims: toDataset('claims', CLAIMS_FIELDS, buildClaims(random, npis)),
    providers: toDataset('providers', PROVIDERS_FIELDS, providers),
    credentialing_applications: toDataset(
      'credentialing_applications',
      APPLICATIONS_FIELDS,
      buildApplications(random, npis),
    ),
  }
}

/** Built once and never mutated. Chaos is applied as a view over it, not a change to it. */
const WORLD = buildWorld()

export function readWorld(dataset: string): Dataset | null {
  return WORLD[dataset] ?? null
}

export function worldDatasetIds(): string[] {
  return Object.keys(WORLD)
}

/** Field names as the world knows them, before any chaos rename. Used by the chaos panel. */
export function worldFieldNames(dataset: string): string[] {
  return readWorld(dataset)?.schema.fields.map((field) => field.name) ?? []
}
