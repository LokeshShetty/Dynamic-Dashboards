import { z } from 'zod'

/**
 * Stored state is input. It was written by an earlier build, or by a person with devtools open,
 * so it is validated on the way in exactly like a pasted configuration.
 */
export const storedRevisionSchema = z.object({
  version: z.number().int().min(0),
  savedAt: z.string().min(1),
  config: z.string(),
})

export const storedDashboardSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().min(0),
  savedAt: z.string().min(1),
  config: z.string(),
  revisions: z.array(storedRevisionSchema),
})

export const storedIndexSchema = z.array(z.string().min(1))

/** What one tab tells the others when it writes. Messages are input too. */
export const saveMessageSchema = z.object({
  kind: z.literal('dashboard-saved'),
  dashboardId: z.string().min(1),
  version: z.number().int().min(0),
  savedAt: z.string().min(1),
  sender: z.string().min(1),
})

export type StoredDashboard = z.infer<typeof storedDashboardSchema>
export type SaveMessage = z.infer<typeof saveMessageSchema>
