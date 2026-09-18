/**
 * The only place console is allowed. Events are dot named so they read as a stream:
 * data.request.failed, chaos.param.ignored.
 */
type LogPayload = Record<string, unknown>

/* oxlint-disable no-console */
export const log = {
  info: (event: string, payload?: LogPayload) => console.info(event, payload ?? {}),
  warn: (event: string, payload?: LogPayload) => console.warn(event, payload ?? {}),
  error: (event: string, payload?: LogPayload) => console.error(event, payload ?? {}),
}
/* oxlint-enable no-console */
