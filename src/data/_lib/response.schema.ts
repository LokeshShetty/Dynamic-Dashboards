import { z } from 'zod'

import { FIELD_TYPES } from '@/constants/data'

/**
 * The data layer validates its own answers. A fake source is still a boundary, and the
 * corrupt-response control proves the renderer never trusts a payload just because it
 * came from inside the app.
 */
const dataValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()])

export const datasetSchemaResponseSchema = z.object({
  dataset: z.string().min(1),
  fields: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(FIELD_TYPES),
      nullable: z.boolean(),
    }),
  ),
  rowCount: z.number().int().min(0),
})

export const dataResultResponseSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('value'),
    value: dataValueSchema,
    matchedRows: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('rows'),
    rows: z.array(z.record(z.string(), dataValueSchema)),
    matchedRows: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('series'),
    points: z.array(
      z.object({
        x: z.string(),
        values: z.record(z.string(), z.union([z.number().finite(), z.null()])),
      }),
    ),
    matchedRows: z.number().int().min(0),
  }),
])
