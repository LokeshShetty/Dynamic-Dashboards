# Design document

Living document. It is updated at the end of every phase, not written from memory at the end.

## The promise

Every widget is either showing the truth or visibly showing that it cannot.

Everything below follows from that. Where a trade-off exists, the option that keeps the promise
wins, even when it costs convenience, a render pass, or a nicer happy path. Each trade-off is
recorded in the decision log with the reason.

Three failure modes the promise rules out:

1. A widget that renders stale or partial data as if it were current and complete.
2. A widget that fails silently: blank space, an empty table, a zero that is really an error.
3. One bad widget taking down the dashboard around it, which hides the truth of every other widget.

## Status

| Phase                                     | State       |
| ----------------------------------------- | ----------- |
| 1. Project setup                          | Done        |
| 2. Config schema, migrations, tests       | Not started |
| 3. Data layer, chaos controls, fetch hook | Not started |
| 4. Rendering and the four widget types    | Not started |
| 5. Dashboard filters                      | Not started |
| 6. Widget editor                          | Not started |
| 7. Persistence, revisions, conflicts      | Not started |
| 8. Hostile configuration corpus           | Not started |
| 9. Documentation and self-review          | Not started |

## Shape of the system (planned)

- A **configuration** is versioned JSON: `schemaVersion` describes the format, a separate `version`
  counter describes the save and drives compare and swap on write.
- A **rendered dashboard** is the interpretation of one configuration against a data source at one
  moment. It is never assumed to be correct: each widget is validated on its own.
- Validation is per widget, not per dashboard, so one malformed widget cannot invalidate a whole
  saved dashboard.
- Every widget renders through a single `WidgetFrame` that owns all display states: loading, ok,
  empty, error, stale, invalid config, unresolvable binding. Widgets never render their own spinner
  or error text.
- The data layer is fake, in memory, asynchronous, slow by default and failing sometimes, with
  runtime controls to make it worse and to rename fields or change their types under a live
  dashboard.
- Filter definitions and defaults live in the configuration; current filter values live in the URL.
- Persistence is localStorage behind the same async and chaos layer, with compare and swap on save
  and cross-tab notification over `BroadcastChannel`.

## Decision log

### Phase 1: project setup

| Decision                                                        | Why                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 with React Router 8                                    | The current router major requires React 19.2 or newer. Chosen over pinning the router back a major version to stay on supported, current APIs.                                                                          |
| TypeScript strict plus `noUncheckedIndexedAccess`               | The renderer walks arbitrary user data. `row[column]` is genuinely `T \| undefined`, and the type system should say so rather than let it slip.                                                                         |
| `exactOptionalPropertyTypes`                                    | An absent option and an option explicitly set to `undefined` mean different things in a configuration. Keeping them distinct avoids silent fallbacks.                                                                   |
| oxlint rather than ESLint                                       | Same rules that matter here (`no-console`, `react/no-danger`, hooks rules, `no-explicit-any`) at a fraction of the run time.                                                                                            |
| Import order enforced by a Prettier plugin                      | oxlint has no `import/order` rule, so ordering is autofixed at format time and verified by `format:check` instead of being an unchecked convention.                                                                     |
| Semantic colour tokens only, defined in `src/styles/tokens.css` | State colours (danger, warning, stale, success) have to mean the same thing in every widget, in light and dark, or the visible-failure states become unreadable.                                                        |
| TanStack Query retries once, does not refetch on focus          | A single retry absorbs the fake data layer's transient failures; an error that survives a retry is real and gets shown. Refetch on focus would hide staleness by silently fixing it when the reviewer looks at the tab. |

## Open questions

- How stale is stale: a fixed age, or per widget and configurable?
- Whether an unresolvable binding is a configuration error (editor time) or a data error (render
  time), given that a field can disappear after the configuration was valid.
