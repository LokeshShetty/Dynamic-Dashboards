import type { ZodError } from 'zod'

import type { ConfigIssue } from '../_types'

/** Renders a zod path as something a user can find in their JSON: widgets[2].value.field */
export function formatIssuePath(path: ReadonlyArray<PropertyKey>): string {
  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === 'number') return `${formatted}[${segment}]`
    if (formatted === '') return String(segment)
    return `${formatted}.${String(segment)}`
  }, '')
}

export function toConfigIssues(error: ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({
    path: formatIssuePath(issue.path),
    message: issue.message,
  }))
}

/** A one-line summary for places with no room for the full list, such as a widget tile. */
export function summarizeIssues(issues: ReadonlyArray<ConfigIssue>): string {
  const [first] = issues
  if (!first) return 'invalid configuration'
  const where = first.path === '' ? '' : `${first.path}: `
  if (issues.length === 1) return `${where}${first.message}`
  return `${where}${first.message} (+${issues.length - 1} more)`
}
