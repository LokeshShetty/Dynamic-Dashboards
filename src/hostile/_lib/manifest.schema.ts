import { z } from 'zod'

/** The manifest is the source of truth, so it is validated before it is trusted. */
const widgetStateSchema = z.enum(['valid', 'invalid', 'duplicate-id', 'overlapping-layout'])

export const manifestEntrySchema = z.object({
  file: z.string().min(1),
  attacks: z.string().min(1),
  notes: z.string().optional(),
  expect: z.discriminatedUnion('outcome', [
    z.object({ outcome: z.literal('dashboard-error'), code: z.string().min(1) }),
    z.object({ outcome: z.literal('unsupported-version'), found: z.number().int() }),
    z.object({
      outcome: z.literal('loads'),
      migratedFrom: z.number().int().nullable(),
      filters: z.number().int().min(0),
      droppedFilters: z.number().int().min(0),
      widgets: z.array(widgetStateSchema),
    }),
  ]),
})

export const manifestSchema = z.object({
  $comment: z.string().optional(),
  files: z.array(manifestEntrySchema).min(1),
})

export type ManifestEntry = z.infer<typeof manifestEntrySchema>
