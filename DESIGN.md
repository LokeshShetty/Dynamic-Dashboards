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
| 2. Config schema, migrations, tests       | Done        |
| 3. Data layer, chaos controls, fetch hook | Done        |
| 4. Rendering and the four widget types    | Done        |
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

## The configuration format

A configuration is JSON with two independent numbers on it:

- `schemaVersion` describes the **format**. This build understands version 2 and migrates
  version 1 forward. It is bumped by developers when the format changes.
- `version` is the **save counter**. It is bumped on every save and is what persistence
  compares on write, so two people cannot overwrite each other without noticing.

```jsonc
{
  "schemaVersion": 2,
  "id": "demo",
  "title": "Operations overview",
  "version": 4,
  "updatedAt": "2026-09-01T09:00:00.000Z", // optional: absent means unknown, never invented
  "dataset": "orders",
  "layout": { "columns": 12 },
  "filters": [
    { "id": "region", "kind": "select", "label": "Region", "field": "region", "options": [] },
  ],
  "widgets": [
    {
      "id": "revenue",
      "kind": "metric",
      "title": "Revenue",
      "layout": { "colSpan": 3, "rowSpan": 1 },
      "value": { "field": "revenue", "aggregate": "sum" },
      "format": { "style": "currency", "currency": "USD", "decimals": 0 },
    },
  ],
}
```

Four widget kinds, discriminated by `kind`: `metric`, `table`, `chart`, `text`. Four filter
kinds, discriminated by `kind`: `select`, `multi-select`, `date-range`, `search`. A widget opts
out of a filter with `ignoredFilterIds`.

Composition is a flow grid: widgets render in array order, each spanning `colSpan` of the
dashboard's 12 columns. Free positioning was rejected because overlapping and out of bounds
coordinates add failure modes that say nothing new about the promise.

The zod schemas in `src/dashboard/_lib/config.schema.ts` are the only definition of this format.
The loader, the editor form and the hostile corpus all validate against them, so no second,
quietly different idea of what is valid can exist.

### Limits

Applied before validation, in `src/dashboard/_constants.ts`:

| Limit              | Value  | Why                                                          |
| ------------------ | ------ | ------------------------------------------------------------ |
| Configuration size | 256 KB | Rejecting a document must cost less than rendering one       |
| Nesting depth      | 10     | A deep document should not be able to exhaust the stack      |
| Widgets            | 50     | Bounds the per widget validation and render work             |
| Filters            | 20     | Bounds the URL state and the query fan out                   |
| Title              | 200    | Bounds what a title can do to the layout                     |
| Reserved keys      | none   | `__proto__`, `constructor`, `prototype` anywhere is an error |

## The load pipeline

One entry point, `loadDashboardConfig(rawText)`, runs six stages in order:

1. **Size guard** on the raw text, measured in bytes rather than characters.
2. **`JSON.parse`** inside a try, with the parser's own message kept for the error screen.
3. **Shape guard**: top level is an object, depth within the limit, no reserved key anywhere,
   widget count within the limit. The walk is iterative, because a recursive walk would itself
   be a way to crash the renderer with a deep enough document.
4. **Migration** by version, chained, each step pure and idempotent.
5. **Dashboard shell validation**: everything except the contents of `widgets`.
6. **Per widget validation**: each entry validated on its own, then checked for a duplicate id.

Binding resolution against the live dataset schema is stage seven and lands with the data layer.
It is deliberately separate from validation: a configuration that was valid when it was saved can
stop resolving later because a field was renamed, and those two failures need different wording on
the tile.

The result is a discriminated union, and every branch renders something true:

| Outcome               | What the user sees                                                                     |
| --------------------- | -------------------------------------------------------------------------------------- |
| `loaded`              | The dashboard, plus a per widget slot that is valid, invalid or a duplicate id         |
| `unsupported-version` | Read only banner naming the version found and the version supported, plus the raw JSON |
| `invalid`             | An error screen with the exact reason, the path, and the raw text                      |

A widget slot is always renderable. `invalid` carries the zod issues and the id if one could be
read, so the tile can be labelled. `duplicate-id` carries the index of the widget that claimed the
id first.

## Edge cases and what happens

| Situation                                       | Behaviour                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Two widgets with the same id                    | First renders, the later one renders as an error tile naming the duplicate                        |
| Widget with an unknown `kind`                   | That tile reports the unknown kind, the rest of the dashboard renders                             |
| Widget with an unknown key                      | That tile is invalid: an ignored setting is a widget showing something the author did not ask for |
| `schemaVersion` newer than supported            | Read only, banner with found and supported versions, raw JSON shown                               |
| `schemaVersion` missing, fractional or Infinity | Dashboard level error naming the problem                                                          |
| `__proto__` anywhere, or as a binding field     | Rejected by the shape guard, or by the field name check in the schema                             |
| `1e999` in a number field                       | `JSON.parse` yields Infinity, the schema rejects it                                               |
| Filter default outside its own options          | Dashboard level error: a filter that cannot select its default would filter every widget wrongly  |
| Date range default that ends before it starts   | Dashboard level error                                                                             |
| Truncated or trailing comma JSON                | Error screen with the parser message and the original text                                        |
| A v1 chart with no aggregate                    | The migration leaves it missing, so that one tile reports it                                      |

## The data layer

Three synthetic datasets, generated from a fixed seed and anchored to a fixed date so every
reviewer sees the same numbers: `claims` (800 rows), `providers` (60) and
`credentialing_applications` (150). Nothing in them describes a real person: parties are
organisations, identifiers are sequential, reviewers are queues. Each dataset exposes its own
schema, field name to type, through the same asynchronous client that serves data, because a
dashboard binds to the schema and the schema is exactly what chaos can change.

The client is in memory but behaves like a network: every call is asynchronous, slow by default,
sometimes fails, and takes an `AbortSignal` that it actually honours. A request that is
cancelled stops waiting; it does not resolve into a void.

### Chaos controls

Defaults are 1200 ms latency with 800 ms of jitter, a 10 percent failure rate and a 2 percent
timeout rate, so a reviewer meets loading, retry and error states without touching anything.

| Control               | What it does                                                 | Changes the truth |
| --------------------- | ------------------------------------------------------------ | ----------------- |
| Latency, jitter       | How long every request takes                                 | No                |
| Failure rate          | Share of requests that are refused                           | No                |
| Timeout rate          | Share of requests that never answer at all                   | No                |
| Corrupt next response | The next payload comes back malformed                        | No                |
| Rename field          | `amount_cents` answers only to `amount_cents_v2` from now on | Yes               |
| Change field type     | A number field starts reporting and serving text             | Yes               |
| Drop dataset          | The dataset stops existing                                   | Yes               |

The three that change the truth bump a **chaos epoch**. The epoch is part of every query key, so
the moment the world changes, every widget asks again rather than continuing to show an answer
about a world that is gone.

Three ways to drive it, all the same store:

- The panel, bottom right of the dashboard.
- The query string: `?latency=1500&jitter=0&failRate=0.3&timeoutRate=0.1`. A parameter that does
  not parse is ignored and logged, never quietly reinterpreted.
- `window.__chaos` in the console: `.set({ latencyMs: 4000 })`, `.corruptNextResponse()`,
  `.renameField('claims', 'amount_cents', 'amount_cents_v2')`,
  `.changeFieldType('claims', 'amount_cents', 'text')`, `.dropDataset('claims')`,
  `.restoreWorld()`, `.reset()`.

### Failure vocabulary

The client throws one typed error, and the kind decides everything downstream:

| Kind               | Cause                                  | Retried | Shown as             |
| ------------------ | -------------------------------------- | ------- | -------------------- |
| `request-failed`   | The source refused                     | Yes     | Error                |
| `timeout`          | No answer within 8 seconds             | Yes     | Error                |
| `aborted`          | The caller cancelled                   | No      | Nothing, it is gone  |
| `corrupt-response` | The payload failed its own schema      | No      | Error                |
| `unknown-dataset`  | The dataset is gone                    | No      | Unresolvable binding |
| `unknown-field`    | The field was renamed or never existed | No      | Unresolvable binding |
| `field-type`       | The field cannot support the aggregate | No      | Unresolvable binding |

Binding failures are never retried: waiting does not bring back a field that was renamed. They
are also worded differently on the tile, because the fix is to edit the configuration, not to
try again.

### useWidgetData

One hook maps a widget's query to the state its frame renders: `loading`, `ok`, `empty`,
`stale`, `error`, `unresolvable-binding`.

The query key is `['widget-data', dashboardId, widgetId, chaosEpoch, query]`, and the query
object carries the dataset, the binding and the filter values. Everything that can change the
answer is in the key, which is what makes a late answer harmless: it is written to the key it
was asked under, and that key is no longer the one on screen. The one test in this phase proves
exactly that, with fake timers: a slow question, a filter change, the fast answer, then the slow
answer landing afterwards, and the screen still showing the fast one.

Two states deserve their wording:

- **empty** is not zero. A metric whose value is null is empty, because rendering it as `0` is
  the clearest possible way to show something untrue.
- **stale** keeps the last good data together with the time it was fetched, the failure that
  stopped the refresh and when that happened. Old numbers are never presented as live ones, and
  they are never silently thrown away either.

### Which guarantees come from where

| Guarantee                                                            | Source                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------ |
| A response is stored against the key it was requested under          | TanStack Query                                         |
| Identical in-flight keys are deduplicated                            | TanStack Query                                         |
| Retry scheduling, backoff, and the attempt counter                   | TanStack Query                                         |
| The last successful data survives a failed refetch                   | TanStack Query                                         |
| An `AbortSignal` is handed to the fetch and fired on teardown        | TanStack Query                                         |
| That signal is actually respected, so cancelled work stops           | Our client                                             |
| The key contains everything that changes the answer                  | Our hook, and the reason the race test passes          |
| The 8 second timeout                                                 | Our client. TanStack Query has no timeout of its own   |
| Only transport failures retry, binding failures never do             | Our retry predicate                                    |
| The world changing invalidates every widget                          | Our chaos epoch. Query cannot know a field was renamed |
| Empty is distinguished from zero, stale from fresh, binding from bug | Our state mapping                                      |
| A malformed payload is rejected rather than rendered                 | Our response schemas                                   |

## Rendering

### One union, one renderer

A widget is in exactly one of seven states, and `WidgetFrame` is the only component that renders
any of them:

| State          | What it means                                 | What the tile shows                                                        |
| -------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `invalid`      | The configuration for this widget is wrong    | Badge, the reason, the failing paths, and the widget's own JSON            |
| `unresolvable` | The configuration no longer matches the world | Badge and the field or dataset that is missing, renamed or the wrong type  |
| `loading`      | First answer has not arrived                  | A skeleton shaped like the widget that is coming                           |
| `ok`           | Current data                                  | The widget                                                                 |
| `empty`        | The query matched nothing                     | Badge and a sentence saying so, never a zero                               |
| `error`        | The source could not answer                   | Badge, the reason, a retry button, and `retrying (n/3)` while it retries   |
| `stale`        | Old data, and the refresh failed              | The old data dimmed, `stale since HH:MM:SS, refresh failed: reason`, retry |

Widget bodies receive data or they are not rendered at all. They cannot render a spinner, a
zero, an empty string or an error of their own, because they are never called in those states.

A state with no data to show takes over the tile rather than sitting as a strip at the top of an
empty rectangle: icon, state, the reason in the reader's words, a way to act on it and the
widget's own configuration, centred in the space the data would have filled. These states are
the product here, so they are composed like it.

Every tile also carries a **Show configuration** disclosure, including tiles that failed before
a widget existed: the raw entry is kept from the loader and printed as it was written.

### The crash net

Each widget body sits in its own error boundary. If something throws for a reason nothing
predicted, the tile becomes `Widget crashed: <message>` with a retry button, the crash is logged
as `widget.render.crashed`, and every other widget on the dashboard carries on.

### Per widget decisions

- **Metric.** One aggregate over one field. Anything other than `count` over a non numeric field
  is refused by name: `a sum needs a number field, and "status" is text`. There is no coercion
  anywhere, so a missing or non numeric value cannot arrive as `NaN` or as `0`.
- **Table.** Columns resolve one at a time. A renamed column is marked unresolvable in its own
  header, its cells show a dash, and the other columns still render. Sorting and paging happen
  in the browser over a capped window of rows; the footer says how many rows matched in total, so
  a capped window is never mistaken for the whole result. A configured sort field that has
  disappeared leaves the rows in their natural order and says so rather than implying an order.
- **Chart.** Recharts is lazy loaded behind a skeleton of the same size, so the 380 KB it costs
  only arrives when a chart is actually on screen. A numeric x axis is refused, because plotting
  numbers as categories invents an ordering; a non numeric y is refused, because there is nothing
  to measure. Grouping and measuring are checked separately and can never be confused for each
  other: the field a chart groups by has to be a category, usually text, while the field it
  measures has to be a number, and the result says which field it grouped by rather than leaving
  the renderer to infer it. Grouping produces one line per value, capped at eight, and a chart
  that would need more says how many it found.
- **Text.** The body is parsed into tokens and rendered as React elements. There is no HTML path
  anywhere and the grammar has no links or images, so there is nothing for a hostile
  configuration to smuggle a URL or a script through. `dangerouslySetInnerHTML` is banned by lint.

### Layout

Widgets are placed on a 12 column grid by `layout { x, y, w, h }`. A widget that runs past the
right edge fails validation and becomes one invalid tile. Two widgets that claim the same cell
are a collision: the first keeps the cell and the second becomes an invalid tile naming what it
collided with, rather than the grid silently reflowing so that a dashboard never looks the same
twice.

### Money

Field schemas carry a unit. `amount_cents` holds cents, so a currency format divides by a hundred
and renders `$4,210`. A currency format over a field with no money unit has no correct answer, so
it is an unresolvable presentation with a reason rather than a silent fallback to a plain number
that a claims reader would read as dollars anyway.

### Refreshing

Every tile has its own refresh, and the dashboard header has one that invalidates every widget on
it. Both go through the same query keys as everything else, so a manual refresh cannot produce a
state the automatic path could not.

## Decision log

### Phase 1: project setup

| Decision                                                        | Why                                                                                                                                                                                                                     |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 with React Router 8                                    | The current router major requires React 19.2 or newer. Chosen over pinning the router back a major version to stay on supported, current APIs.                                                                          |
| TypeScript strict plus `noUncheckedIndexedAccess`               | The renderer walks arbitrary user data. `row[column]` is genuinely `T \| undefined`, and the type system should say so rather than let it slip.                                                                         |
| `exactOptionalPropertyTypes` tried, then dropped                | It fights third party types (Recharts props, React Hook Form defaults, query options) for little gain here: zod already guards the boundary where an absent field and an explicit `undefined` differ.                   |
| oxlint rather than ESLint                                       | Same rules that matter here (`no-console`, `react/no-danger`, hooks rules, `no-explicit-any`) at a fraction of the run time.                                                                                            |
| Import order enforced by a Prettier plugin                      | oxlint has no `import/order` rule, so ordering is autofixed at format time and verified by `format:check` instead of being an unchecked convention.                                                                     |
| Semantic colour tokens only, defined in `src/styles/tokens.css` | State colours (danger, warning, stale, success) have to mean the same thing in every widget, in light and dark, or the visible-failure states become unreadable.                                                        |
| TanStack Query retries once, does not refetch on focus          | A single retry absorbs the fake data layer's transient failures; an error that survives a retry is real and gets shown. Refetch on focus would hide staleness by silently fixing it when the reviewer looks at the tab. |

### Phase 2: configuration layer

| Decision                                                         | Why                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Widgets validated one at a time, dashboard shell separately      | One malformed widget must not invalidate the widgets around it. The cost is that `widgets` is typed as `unknown[]` in the shell schema and narrowed per entry.                                                                                     |
| Unknown keys rejected rather than stripped                       | A silently ignored `aggregate` or `format` produces a number that looks right and is not what the author asked for. The cost is that a future format's extra key fails on an older build, which is what the `schemaVersion` gate is for.           |
| Duplicate ids render as an error tile, not dropped or merged     | Dropping hides half the author's dashboard. Rendering both makes two tiles fight over one identity in the URL, in the editor and in React keys.                                                                                                    |
| Newer `schemaVersion` opens read only with the raw JSON          | Rendering a format we do not understand is the definition of showing something untrue. Read only keeps the configuration recoverable instead of unopenable.                                                                                        |
| Bad filter definitions fail at dashboard level                   | A filter applies to many widgets. Dropping it and carrying on would show every widget unfiltered data under a filter bar that claims otherwise. The cost is that one bad filter blocks the whole dashboard, which the error screen states exactly. |
| Migrations may supply presentation defaults, never data bindings | A missing layout can be defaulted without lying. A missing aggregate cannot: guessing `sum` would render a confident wrong number. The v1 chart with no aggregate stays invalid on purpose.                                                        |
| Reserved keys rejected, and bindings may not name them           | `row['__proto__']` hands a widget the prototype chain instead of data. Rejecting at the document level and at the binding level closes both doors.                                                                                                 |
| The only entry point takes text, not an object                   | The size guard needs the text, and one path means the editor preview and the stored configuration cannot take different routes to different verdicts.                                                                                              |
| Errors are returned, never thrown                                | Every failure has to reach a screen. A thrown error in a loader is one refactor away from a blank page.                                                                                                                                            |

### Phase 3: data layer

| Decision                                            | Why                                                                                                                                                                        |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chaos lives in a Zustand store, not in React state  | A request has to see the conditions in force at the moment it runs. The store is readable outside React, so the client, the console handle and the test all see one truth. |
| World mutations are a view over immutable data      | Renames and type changes are applied when serving, so nothing is destroyed and restoreWorld is honest rather than a second guess at what the data used to be.              |
| Binding failures are never retried                  | Retrying a renamed field spends three attempts and several seconds to arrive at the same answer, and delays the one message that helps: the field is gone.                 |
| The timeout is an abort, not a promise race         | A race leaves the losing request running. Aborting means the work actually stops, which is the difference between a timeout and a lie about one.                           |
| The data layer validates its own responses          | A fake source is still a boundary. The corrupt-next-response control proves the renderer does not trust a payload just because it came from inside the app.                |
| The chaos epoch is part of every query key          | It is the only way a cache can find out that a saved configuration now points at a world that no longer matches it.                                                        |
| Empty is a state, not a zero                        | A metric with no matching rows that renders 0 is the most confident possible way to show something untrue.                                                                 |
| The client throws, everything else returns a Result | TanStack Query decides what to retry from a rejected promise. The throw is confined to that boundary and carries a typed error, so nothing parses a message to decide.     |

### Phase 4: rendering

| Decision                                               | Why                                                                                                                                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One state union, rendered in exactly one component     | If a widget body could render its own loading or error state, the promise would have to be re-checked in four places and would quietly stop holding in the fifth.                  |
| A table resolves each column on its own                | One renamed column costing the reader nine good ones is a worse failure than the rename. The dead column is marked in its own header, so nothing is hidden by keeping the rest.    |
| A metric or a chart fails whole                        | Unlike a column, a metric with a missing field has nothing left to show, and a chart missing its measure would render an axis with no meaning.                                     |
| A capped row window is stated on the tile              | Sorting and paging in the browser is quick, but a reader who can page through 200 rows will assume there are 200. The footer says how many matched.                                |
| Formatting is resolved against the field's unit        | Currency over a unitless number is a presentation with no correct answer. Refusing it by name beats a plain number that a claims reader reads as dollars anyway, off by a hundred. |
| Markdown is a parser, not a renderer of HTML           | The text widget is the one place configuration content reaches the DOM. Tokens to React elements has no HTML path at all, so there is no sanitiser to get wrong.                   |
| Layout collisions are per widget invalid, not a reflow | A grid that reflows to fit a broken layout shows a dashboard nobody arranged, and the reader cannot tell which one they are looking at.                                            |
| Recharts is lazy loaded behind a same size skeleton    | It is 380 KB of the bundle for a widget type a dashboard may not even use, and a skeleton that matches the chart keeps the layout still while it arrives.                          |
| Skeletons instead of spinners                          | A spinner says only that something is happening. A skeleton in the shape of the widget says what is coming and keeps the page from jumping when it arrives.                        |

## Open questions

- How stale is stale: a fixed age, or per widget and configurable?
- Whether an unresolvable binding reads better as a configuration problem or a data problem on the
  tile, given that a field can disappear long after the configuration was valid.
- Whether a widget that ignores a filter should say so on the tile, since a reader comparing two
  tiles under the same filter bar has no other way to know.
