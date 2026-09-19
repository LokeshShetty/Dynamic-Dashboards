# Design document

Living document. It is updated at the end of every phase, not written from memory at the end.

## Contents

- [The promise](#the-promise)
- [Shape of the system](#shape-of-the-system)
- [The configuration format](#the-configuration-format)
- [The load pipeline](#the-load-pipeline)
- [Edge cases and what happens](#edge-cases-and-what-happens)
- [The data layer](#the-data-layer)
- [Rendering](#rendering)
- [Dashboard filters](#dashboard-filters)
- [The editor](#the-editor)
- [Persistence, revisions and conflicts](#persistence-revisions-and-conflicts)
- [The hostile corpus](#the-hostile-corpus)
- [Arranging the grid](#arranging-the-grid)
- [UI primitives](#ui-primitives)
- [Decision log](#decision-log)
- [Guarantees and non-guarantees](#guarantees-and-non-guarantees)
- [Security](#security)
- [Accessibility](#accessibility)
- [What I would do next](#what-i-would-do-next)
- [Known limits](#known-limits)
- [Open questions](#open-questions)
- [Appendix: how this was built](#appendix-how-this-was-built)

## The promise

Every widget is either showing the truth or visibly showing that it cannot.

Everything below follows from that. Where a trade-off exists, the option that keeps the promise
wins, even when it costs convenience, a render pass, or a nicer happy path. Each trade-off is
recorded in the decision log with the reason.

Three failure modes the promise rules out:

1. A widget that renders stale or partial data as if it were current and complete.
2. A widget that fails silently: blank space, an empty table, a zero that is really an error.
3. One bad widget taking down the dashboard around it, which hides the truth of every other widget.

## Shape of the system

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

- `schemaVersion` describes the **format**. This build understands version 3, and migrates
  version 1 and version 2 forward on the way in. It is bumped by developers when the format
  changes.
- `version` is the **save counter**. It is bumped on every save and is what persistence compares
  on write, so two people cannot overwrite each other without noticing.

This is the shipped demo, `src/dashboard/_fixtures/dashboard-v3.json`, with most of its widgets
elided:

```jsonc
{
  "schemaVersion": 3,
  "id": "demo",
  "title": "Claims operations",
  "version": 6,
  "updatedAt": "2026-09-15T09:00:00.000Z", // optional: absent means unknown, never invented
  "dataset": "claims",
  "layout": { "columns": 12 },
  "filters": [
    {
      "id": "status",
      "kind": "select",
      "label": "Status",
      "field": "status",
      "options": [{ "value": "paid", "label": "Paid" }],
    },
    {
      "id": "submitted",
      "kind": "date-range",
      "label": "Submitted",
      "field": "submitted_at",
      "defaultValue": { "from": "2026-08-01", "to": "2026-09-15" },
    },
  ],
  "widgets": [
    {
      "id": "billed",
      "kind": "metric",
      "title": "Billed",
      "layout": { "x": 0, "y": 0, "w": 3, "h": 1 },
      "value": { "field": "amount_cents", "aggregate": "sum" },
      "format": { "style": "currency", "currency": "USD", "decimals": 0 },
    },
    {
      "id": "billed-by-week",
      "kind": "chart",
      "title": "Billed by week and payer",
      "layout": { "x": 0, "y": 1, "w": 8, "h": 3 },
      "chartType": "line",
      "x": { "field": "submitted_at", "bucket": "week" },
      "series": [{ "field": "amount_cents", "aggregate": "sum", "label": "Billed" }],
      "groupBy": { "field": "payer" },
    },
  ],
}
```

Four widget kinds, discriminated by `kind`: `metric`, `table`, `chart`, `text`. Four filter
kinds, discriminated by `kind`: `select`, `multi-select`, `date-range`, `search`. A widget opts
out of a filter with `ignoredFilterIds`, and may read a different `dataset` from the dashboard's.

Widgets are **placed**, not flowed: `layout { x, y, w, h }` puts each one on the 12 column grid,
so a dashboard looks the way it was arranged whatever order the array happens to be in. The
decision log records the move from spans to coordinates and what it cost.

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

Binding resolution against the live dataset schema is stage seven, and it happens in the data
layer when a widget asks for data. It is deliberately separate from validation: a configuration that was valid when it was saved can
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
| Filter default outside its own options          | That filter is dropped with a notice in the filter bar, the rest of the dashboard renders         |
| Date range default that ends before it starts   | That filter is dropped with a notice in the filter bar                                            |
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

| Kind               | Cause                                  | Retried    | Shown as             |
| ------------------ | -------------------------------------- | ---------- | -------------------- |
| `request-failed`   | The source refused                     | Yes, twice | Error                |
| `timeout`          | No answer within 8 seconds             | Yes, twice | Error                |
| `aborted`          | The caller cancelled                   | No         | Nothing, it is gone  |
| `corrupt-response` | The payload failed its own schema      | No         | Error                |
| `unknown-dataset`  | The dataset is gone                    | No         | Unresolvable binding |
| `unknown-field`    | The field was renamed or never existed | No         | Unresolvable binding |
| `field-type`       | The field cannot support the aggregate | No         | Unresolvable binding |

Binding failures are never retried: waiting does not bring back a field that was renamed. They
are also worded differently on the tile, because the fix is to edit the configuration, not to
try again.

### useWidgetData

One hook maps a widget's query to the state its frame renders: `loading`, `ok`, `empty`,
`stale`, `error`, `unresolvable`. Those are the same seven names the frame switches on, listed
under Rendering: there is one vocabulary, not one per layer.

The query key is `['widget-data', dashboardId, widgetId, chaosEpoch, query]`, and the query
object carries the dataset, the binding and the filter values. Everything that can change the
answer is in the key, which is what makes a late answer harmless: it is written to the key it
was asked under, and that key is no longer the one on screen.
`src/dashboard/_hooks/use-widget-data.test.tsx` proves exactly that, with fake timers: a slow
question, a filter change, the fast answer, then the slow answer landing afterwards, and the
screen still showing the fast one. It keeps a second observer on the slow question so that answer
genuinely arrives rather than being cancelled, and it fails if the query key loses the filters.

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

Every tile can show the configuration it came from, including tiles that failed before a widget
existed: the raw entry is kept from the loader and printed as it was written. On a tile that is
showing data it sits behind an information button beside refresh, so the configuration is one
click away rather than a row of chrome under every widget; on a tile that cannot show data it
stays inside the failure panel, next to the reason it is there. Same view, same text, and the
same behaviour whether the dashboard is being read or edited.

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
  The table is **not virtualised, on purpose**: it paginates, so between 8 and 100 rows are in
  the DOM at a time and there is nothing for a virtualiser to save. Virtualisation starts paying
  for itself in the thousands of rendered rows, which this widget cannot reach while it pages.
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

### Names a reader recognises

Column keys are how the data names things, not how people do. `avg of line_items over 86 rows` is
the database talking; `Average of Line items over 86 rows` is the dashboard talking. Field names
are humanised wherever they appear in prose: metric footnotes, table headings with no configured
label, and chart series with no label of their own. Where a name carries its unit as a suffix and
the unit is known, the suffix goes, because the formatter is already showing it: `amount_cents`
formatted as currency reads as **Amount**.

Two places keep the real keys on purpose. The **Show configuration** disclosure prints the widget
exactly as it is stored, and failure messages name the field the configuration asked for, because
both exist to be acted on: a reader fixing a binding needs the string that is actually in the
file.

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

## Dashboard filters

Four kinds, all defined in the configuration and all applying across every widget that can honour
them: `select`, `multi-select`, `date-range` and `search`.

### Where a filter value lives

The configuration owns the **defaults**. The URL owns the **current values**, one readable
parameter per control rather than one encoded blob:

```
/d/demo?f_status=paid&f_payer=Cascade+Mutual,Northwind+Care&f_submitted_from=2026-08-01&f_submitted_to=2026-09-15&f_claim=CLM-1002
```

Nothing about a filter lives in component state, so a link reproduces exactly what the sender was
looking at. The bar shows how many controls differ from the configured defaults and has a reset
that clears every parameter at once.

### The URL is input

Every parameter goes through the same zod schemas the configuration uses, wired into nuqs
parsers. A parameter that does not validate is ignored, the configured default is used in its place, the
parameter is taken back out of the address bar, and the bar says which one it dropped and why:

> Ignored `f_submitted_from`=`not-a-date`: invalid ISO date. Using the configured default instead.

A date range needs both ends. A half range falls back to the configured other end, and says so
when there is none. A range that ends before it starts is refused rather than swapped, because
swapping would silently answer a question nobody asked. None of these paths can crash the page.

Removing the parameter afterwards matters as much as reporting it. A URL that keeps a value the
dashboard refused says one thing while the screen says another, and the next person to be sent
that link inherits the confusion. So the parameter goes and the report stays, until the reader
does something about it: changing any filter, resetting them, or dismissing the notice clears it.
A notice that outlives the problem it describes is one more thing on screen that is not true.

Dates are committed when the field is left rather than on every keystroke. A date input reports a
value after each one, so typing a year gives the year 2, then 20, then 202 on the way to 2026, and
committing those would put a nonsense range in the URL and move the cursor out from under the
person typing.

### Options come from the data, not the configuration

`select` and `multi-select` offer the values the field actually holds right now, fetched through
the same client as everything else, which means they are slow, they can fail, and a renamed field
takes the options away. So the bar is treated as a data surface in its own right:

- every list that comes out of data goes through one searchable dropdown: filter values, and the
  field pickers in the editor and the chaos panel. A native select cannot be searched and a row of
  chips cannot be scanned, so the control is a trigger and a panel of native inputs, radios where
  one value is being chosen and checkboxes where several are, which keeps the keyboard behaviour
  the browser already provides. The search appears once a list is long enough to be worth
  filtering and matches on a debounced term, so typing stays smooth over a few hundred values
  while the field itself updates on every keystroke;
- while the values load, the control shows a skeleton of its own shape;
- if the load fails, the control says why and turns into a text input, so a reader who already
  knows the value they want is never blocked by a failing list;
- when the field holds more values than the control will list, it says it is showing a subset.

A value that is selected but no longer present in the data **stays selected** and is marked
`not present in current data`. Dropping it would quietly widen the query: the widgets would fill
with rows the reader had excluded, under a filter bar that still claimed to exclude them. Instead
the filter still applies, the widgets honestly go empty, and the control explains why.

### Filters and the query

Filters are applied inside the data query, so aggregates run over the filtered rows rather than
being trimmed afterwards. The filter values are part of the query key, which means changing a
filter starts a new query and the in-flight requests under the old values are cancelled: the
observer moves to the new key, TanStack Query cancels the abandoned fetch because our client
consumed its `AbortSignal`, and the answer to the old question can never arrive on screen.

### When a filter cannot apply to a widget

A filter names a field. That field can disappear, or stop being the kind of field the filter
works on: a `select` needs a category, a `date-range` needs a date, a `search` needs text. When
that happens the data layer **skips that filter, returns unfiltered rows, and reports the skip**.
The widget then carries a badge in its header and a line above the data:

> filter "Payer" is not applicable: "payer" is number now, and this filter needs a text or boolean
> field. This widget is showing unfiltered data.

**The trade-off we did not take.** The stricter option is to refuse to render the widget at all,
on the grounds that unfiltered data under a filter bar is misleading. We chose visible and
unfiltered over absent, because the reader loses less: a widget that is present, labelled and
readable lets them see the data and act on the broken filter, while an absent widget tells them
only that something is wrong. The strict option would also spread one bad filter across every
widget on the dashboard, turning a filter problem into a blank page. The badge is what makes the
weaker option honest: it is on the tile, in the header, in words, and it says the data is
unfiltered.

## The editor

Editing is a parameter on the dashboard, `?edit=1`, not a separate screen. The same tiles, the
same filters, the same frame: what is being arranged is the real dashboard in its real state.

### The draft

Entering edit mode copies the loaded configuration into a draft in the store. Every change lands
there and nowhere else, and the draft is previewed by running it through **the same loader the
reader gets**: serialise, guard, migrate, validate the shell, validate each widget. So a widget
that is half configured shows precisely the tile it would show if it were saved that way, down to
the wording.

The header says whether there are unsaved changes, and **Save** is enabled exactly when there are:
with a clean draft the button reads _Saved_ and is disabled, because there is nothing to send.
Saving goes through compare and swap, described under Persistence. Discarding asks first, and so
does leaving edit mode with unsaved changes, because the draft lives in this tab and nowhere else
until it is saved.

### Adding and arranging

The catalogue offers the four widget types. A new widget takes the first free slot on the grid at
a default size for its type, and the editor opens on it immediately: bindings are left empty
rather than guessed, so until a field is chosen the tile says it is not configured yet.

Each tile carries a toolbar: a drag handle, rename, edit, duplicate, remove, and on the tile being
worked on, arrows for moving and resizing. Every control is an icon button with a name that says
which widget it acts on, and remove goes through the confirm dialog.

Moving and resizing themselves are described once, under **Arranging the grid**: a pointer drag
pushes the tiles it lands on, a key press swaps or steps past them, and every arrangement is
checked against the loader's own placement rules before it reaches the draft. The editor cannot
produce a layout that the loader would then report as invalid.

### The form

One dialog, `react-hook-form` with a zod resolver over **the widget schemas the loader uses**.
There is no second definition of what a valid widget is, so nothing can be accepted here that the
reader's loader would reject.

The dataset comes first, because everything below it depends on it: a widget may read the
dashboard's dataset or another one. Fields are then offered from the live dataset schema through
the same client as everything else, so the form is slow when the source is slow, and when the
schema cannot be fetched at all the field name can still be typed rather than blocking the edit.
Aggregates are filtered to the ones that mean something over the chosen field's type, and
presentation options follow the widget type.

A widget bound to a field that no longer exists **keeps its value**, shown in the picker marked
_not in dataset_, with a note saying so. Clearing it silently would lose what the author asked
for, and would make a broken widget look like an unfinished one.

Every keystroke reaches the draft, so the tile behind the dialog re-renders as the form is filled
in. Binding a currency formatted metric to a field with no money unit, or a sum to a text field,
says so on the tile before anything is saved.

Chaos keeps running throughout. Editing while the data layer is failing is the normal case, not a
special one: the form degrades to typed field names, and the tiles behind it show their own
failure states.

## Persistence, revisions and conflicts

### What is stored, and how it is read

Saved state lives in localStorage, one record per dashboard, holding the configuration **as
text** plus a version counter and a capped list of revisions. It is read back through exactly the
same loader as a pasted configuration, because that is what it is: text written by an earlier
build, or by someone with devtools open. A record that does not parse, or does not match the
stored record schema, produces _stored config is corrupt: reason_ with a way forward, never a
blank page.

Every call goes through the same transport as the data layer: slow by default, sometimes refused,
sometimes timed out, always cancellable. A save that is always instant would hide the states this
system exists to handle. Chaos applies to storage too, including corrupting a read so the loader
meets damage the way a reader would.

`localStorage` is also checked for being real rather than assumed: private modes, sandboxed
frames and webviews hand back something that looks like storage and is not, and that arrives as
_this browser will not let the dashboard store anything_ rather than as a crash deeper in.

### Compare and swap, never last write wins

A save carries the version the edit started from. Storage compares it with what is stored and
refuses the write if it has moved on. The refusal is an **outcome, not an error**: it opens a
conflict view listing what differs per widget, as _only in the saved version_, _only in your
draft_ or _different in both_, plus whether dashboard settings differ.

Three ways out, all chosen by the reader:

| Choice        | What happens                                                                       |
| ------------- | ---------------------------------------------------------------------------------- |
| Keep editing  | Nothing is written. The draft stays exactly as it was                              |
| Reload theirs | The draft is dropped and the stored version is loaded                              |
| Overwrite     | Through a confirmation, saves on top of their version. Theirs stays in the history |

Last write wins was rejected outright. It is the same failure as a stale widget: work that looks
saved and is gone. A failed save, for any reason, leaves the draft dirty and untouched, and says
so in a toast that offers to send it again. The retry is offered rather than automatic: a write
that repeats itself without being asked is how a conflict becomes a surprise, and the person who
made the change is the one who should decide whether it goes out a second time.

### What concurrent means here, and what it does not

Two tabs are two users. A save is announced over `BroadcastChannel`, with the `storage` event as a
fallback where that is missing, and both kinds of message are validated with zod, because another
tab is not more trustworthy than a URL.

A tab that hears about a save shows it: _someone saved version 9_. If nothing is being edited
here, reloading is one click. If there is a draft, the offer is to compare rather than to reload,
and **nothing ever reloads itself over unsaved work**.

What this is not:

- Not live collaboration. There is no shared cursor, no presence, no streaming of edits.
- Not a CRDT or any other automatic merge. Conflicts are shown and resolved by a person, because
  merging two dashboard layouts without asking is how both people lose their arrangement.
- Not sharing between machines. localStorage is per browser, per origin. **Real sharing needs a
  backend**, and the store interface is written for that: six asynchronous methods, each taking an
  `AbortSignal`, with a failure vocabulary that already includes the things a network adds. A REST
  implementation replaces `src/storage/_lib/dashboard-store.ts` and nothing above it changes.

### Revisions

Every save appends `{ version, savedAt, config }`. `?rev=4` opens that revision read only, with a
banner saying which of how many it is. Restoring is a **new save** through a confirmation, so the
history is only ever appended to and never rewritten.

History is capped at 30 revisions per dashboard, oldest pruned, because localStorage is a few
megabytes for the whole origin and an uncapped history is a quota failure waiting to happen. The
cap is stated in the header (_n revisions kept_) rather than left to be discovered. A quota
failure that does happen surfaces as a failed save naming the quota.

### Getting configurations in and out

Export downloads exactly what is stored. Import treats the file as hostile input: it goes through
the loader like anything else, and a file that opens lands as a **dirty draft** to be reviewed and
saved through the normal compare and swap path. A file from somewhere else can never overwrite a
dashboard without a person looking at it first.

### Starting from nothing

An unknown id is a dead end with a way forward: _no dashboard with id X_, and a button that
creates an empty one. On a first visit the three shipped configurations are seeded, two of them
deliberately in older formats, and the chaos panel can reset storage back to them.

## The hostile corpus

`hostile-configs/` at the repository root holds 23 configurations written to break the renderer,
with `manifest.json` describing what each one attacks and exactly what it should do. It is not a
folder of examples: `src/hostile-configs.test.ts` reads the folder, asserts that every file is
described in the manifest and named in the README, runs each one through `loadDashboardConfig`,
checks the outcome against the manifest, and afterwards asserts that `Object.prototype` is
untouched. A file with no manifest entry fails the run, and so does a manifest entry with no file.

The app reads **the same files**, through the same module: the chaos panel has a picker that
opens any of them in place of the stored dashboard, read only, with a banner saying it is a
hostile file and not saved. A fixture that had drifted from what the app loads would be worse
than no fixture.

What they cover: text that is not JSON, a root that is not an object, a missing and a future
`schemaVersion`, an old format that must still open, unknown widget types, duplicate ids, layout
numbers that are negative, infinite, fractional and stringly typed, overlapping layouts, a
document too large to parse, one widget past the count limit, nesting past the depth limit, a
title one character over, script tags and `javascript:` links, `__proto__` at the root and
`constructor.prototype` inside a widget, bindings to datasets, fields and types that do not
exist, a filter kind that does not exist, a filter on a field the dataset lost, and right to left
overrides in titles and body text.

**`v1-legacy.json` is the only one expected to open completely fine**, because it is the
migration story: written in the oldest supported format, it comes forward to v3 on the way in.

Four behaviours the corpus forced, which now hold:

- An invalid **filter** definition is dropped with a notice in the filter bar, not a dashboard
  level failure. This reverses the phase 2 decision, and the decision log says so.
- **Overlapping layouts** mark the later widget invalid, deterministically by array order, so the
  same file always produces the same dashboard.
- **Titles and configuration text render inside `<bdi>` with bidi control characters stripped**, so
  a title carrying a right to left override cannot reorder the page around it.
- The **markdown subset has no raw HTML, no links and no images**, so a `javascript:` URL in a text
  widget has nowhere to go: it renders as the characters it is.

## Arranging the grid

Moving and resizing are pointer gestures on the grid itself, with a placeholder showing where a
tile will land, and the arrow keys do the same two jobs from the keyboard: arrows move, shift and
arrows resize, while focus is anywhere in the tile. The toolbar above each tile is left with the
four things that have no gesture: rename, edit, duplicate, remove.

### The one approved feature dependency

`react-grid-layout` does the dragging and resizing. It is the only dependency **added after the
initial stack was agreed**, for a single feature: Recharts, TanStack Query, nuqs, React Hook Form,
Zustand and React Router are all feature dependencies too, chosen up front. It is approved in
CLAUDE.md for three things the browser's own primitives do not give:

- a pointer drag that snaps to grid cells, with a placeholder showing where the tile will land;
- a resize grip with per widget minimum sizes;
- **push and compact semantics**: growing a tile moves the ones below it down rather than landing
  on top of them, and dragging is not bounded by the current content height, so a tile can be
  taken into new space below the last row.

dnd-kit was the obvious alternative and was rejected on the facts rather than on taste: it has
snapping modifiers, but it does no resizing at all, and it has no idea what a grid cell is, so the
collision handling, the push behaviour and the placement rules would all still have been ours to
write. It would have replaced the smallest part of the work.

### Arranging without a pointer

**The library's drag handle and resize grip are pointer only.** They are not the accessible path
and were never meant to be. The accessible path is the toolbar arrows, which appear on the tile
being worked on, and the arrow keys, which do the same two jobs while focus is anywhere in the
tile: arrows move, shift and arrows resize. Both still work with the library in place, and both
are verified against the shipped demo at `/d/demo?edit=1`.

The keyboard and the pointer differ in one way, deliberately. A drag pushes the tiles it lands on
out of the way, because that is what a pointer gesture means. A keyboard step does not push: two
tiles of the same size trade places, and a smaller one is stepped past to the first free space.
Pushing on a single key press would rearrange a dashboard several tiles away from the one the
reader is holding, with no way to see it happen.

Every keyboard arrangement is announced in a polite live region, including the ones that change
nothing: _Billed is at column 4, row 2_, _Claims swapped places with Line items per claim_, or
_Billed: that would leave the top left of the grid_. A pointer drag shows its own result; a key
press that does nothing shows nothing, so silence at the edge of the grid would have told a screen
reader user only that their key press had been ignored.

**What the library is not allowed to decide.** It moves tiles; it does not decide what a valid
layout is. Every arrangement it produces is checked against the loader's own placement rules
before it reaches the draft, and one that would not load is not applied, so the grid snaps back to
the last arrangement that would. Layouts are committed when a drag or a resize finishes, never
while the grid is settling, so opening the editor cannot mark a draft dirty on its own. Each
widget kind carries a minimum size, so a table cannot be dragged down to a sliver of itself.

This matters most where the two disagree. `hostile-configs/overlapping-layout.json` contains two
widgets in the same cells: the library will happily resolve that on screen, but the verdict comes
from the loader, so the later widget still renders as an invalid tile whose reason names what it
sits on top of. What the grid does with a broken layout never changes what the dashboard says
about it.

## UI primitives

There is no component library in this project. Controls are native elements styled with Tailwind
tokens wherever a native element does the job, and the handful of things with no native
equivalent are written by hand into `src/components/ui/` in the shadcn style, one file per
primitive.

The one place a native element was given up is the option list. A `<select>` cannot be searched,
and every list that comes out of data here can be four values today and four hundred next week,
so those go through one hand written dropdown instead. It is still native inside: a trigger
button, and radios or checkboxes in a panel, so selection and keyboard behaviour remain the
browser's. Short fixed lists, such as the aggregates or the chart types, are still a `<select>`,
because a search box over six options is noise.

| Surface                                                         | Built from                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Select and multi-select filter                                  | `searchable-select.tsx`: a trigger button and a panel of native radios or checkboxes, with a debounced search |
| Field pickers, editor and chaos                                 | the same `searchable-select.tsx`                                                                              |
| Short fixed lists (aggregate, chart type, tone, sort direction) | `<select>`                                                                                                    |
| Date range filter                                               | Two `<input type="date">`, committed on blur                                                                  |
| Search filter                                                   | `<input type="search">`, debounced                                                                            |
| Widget configuration                                            | An information button on tiles showing data, `<details>` inside a failure panel                               |
| Table                                                           | `<table>` with `aria-sort` and header buttons                                                                 |
| Modal, confirm dialog                                           | `<dialog>` with `showModal()`, wrapped in `src/components/ui`                                                 |
| Toasts                                                          | Two `aria-live` regions over a Zustand slice                                                                  |

The dialog wrapper adds what the element does not do on its own: closing on a backdrop click,
returning focus to whatever opened it, locking the page behind it, and wiring `aria-labelledby`
and `aria-describedby`. The element itself supplies the top layer, the inert background, the
focus trap and Escape, which is the part that is hardest to hand roll correctly.

Toasts live in two regions that are in the DOM from the first render, so that anything inserted
into them is announced: successes go into a polite region, failures into an assertive one. A
toast dismisses itself after five seconds unless it is hovered or focused, and every toast has a
dismiss button.

## Decision log

### Phase 1: project setup

| Decision                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React 19 with React Router 8                                                                                      | The current router major requires React 19.2 or newer. Chosen over pinning the router back a major version to stay on supported, current APIs.                                                                                                                                                                                                                                                      |
| TypeScript strict plus `noUncheckedIndexedAccess`                                                                 | The renderer walks arbitrary user data. `row[column]` is genuinely `T \| undefined`, and the type system should say so rather than let it slip.                                                                                                                                                                                                                                                     |
| `exactOptionalPropertyTypes` tried, then dropped                                                                  | It fights third party types (Recharts props, React Hook Form defaults, query options) for little gain here: zod already guards the boundary where an absent field and an explicit `undefined` differ.                                                                                                                                                                                               |
| oxlint rather than ESLint                                                                                         | Same rules that matter here (`no-console`, `react/no-danger`, hooks rules, `no-explicit-any`) at a fraction of the run time.                                                                                                                                                                                                                                                                        |
| Import order enforced by a Prettier plugin                                                                        | oxlint has no `import/order` rule, so ordering is autofixed at format time and verified by `format:check` instead of being an unchecked convention.                                                                                                                                                                                                                                                 |
| Semantic colour tokens only, defined in `src/styles/tokens.css`                                                   | State colours (danger, warning, stale, success) have to mean the same thing in every widget, in light and dark, or the visible-failure states become unreadable.                                                                                                                                                                                                                                    |
| TanStack Query retries once by default, does not refetch on focus, **widget queries later raised to two retries** | A retry absorbs the fake data layer's transient failures; an error that survives them is real and gets shown. Refetch on focus would hide staleness by silently fixing it when the reviewer looks at the tab. The client default of one retry still applies to anything that does not set its own; widget and storage queries allow three attempts in total, which is what `retrying (n/3)` counts. |

### Phase 2: configuration layer

| Decision                                                                | Why                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Widgets validated one at a time, dashboard shell separately             | One malformed widget must not invalidate the widgets around it. The cost is that `widgets` is typed as `unknown[]` in the shell schema and narrowed per entry.                                                                                                                                                                                                                                                           |
| Unknown keys rejected rather than stripped                              | A silently ignored `aggregate` or `format` produces a number that looks right and is not what the author asked for. The cost is that a future format's extra key fails on an older build, which is what the `schemaVersion` gate is for.                                                                                                                                                                                 |
| Duplicate ids render as an error tile, not dropped or merged            | Dropping hides half the author's dashboard. Rendering both makes two tiles fight over one identity in the URL, in the editor and in React keys.                                                                                                                                                                                                                                                                          |
| Newer `schemaVersion` opens read only with the raw JSON                 | Rendering a format we do not understand is the definition of showing something untrue. Read only keeps the configuration recoverable instead of unopenable.                                                                                                                                                                                                                                                              |
| Bad filter definitions fail at dashboard level, **reversed in phase 8** | Originally a filter that did not validate failed the whole dashboard, on the grounds that widgets would otherwise show unfiltered data under a bar that claimed to filter. Building the hostile corpus made the cost obvious: one mistyped filter kind cost the reader every widget. Filters are now validated one at a time and a bad one is dropped with a notice in the bar, which is the same treatment widgets get. |
| Migrations may supply presentation defaults, never data bindings        | A missing layout can be defaulted without lying. A missing aggregate cannot: guessing `sum` would render a confident wrong number. The v1 chart with no aggregate stays invalid on purpose.                                                                                                                                                                                                                              |
| Reserved keys rejected, and bindings may not name them                  | `row['__proto__']` hands a widget the prototype chain instead of data. Rejecting at the document level and at the binding level closes both doors.                                                                                                                                                                                                                                                                       |
| The only entry point takes text, not an object                          | The size guard needs the text, and one path means the editor preview and the stored configuration cannot take different routes to different verdicts.                                                                                                                                                                                                                                                                    |
| Errors are returned, never thrown                                       | Every failure has to reach a screen. A thrown error in a loader is one refactor away from a blank page.                                                                                                                                                                                                                                                                                                                  |

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

| Decision                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One state union, rendered in exactly one component           | If a widget body could render its own loading or error state, the promise would have to be re-checked in four places and would quietly stop holding in the fifth.                                                                                                                                                                                                                       |
| A table resolves each column on its own                      | One renamed column costing the reader nine good ones is a worse failure than the rename. The dead column is marked in its own header, so nothing is hidden by keeping the rest.                                                                                                                                                                                                         |
| A metric or a chart fails whole                              | Unlike a column, a metric with a missing field has nothing left to show, and a chart missing its measure would render an axis with no meaning.                                                                                                                                                                                                                                          |
| A capped row window is stated on the tile                    | Sorting and paging in the browser is quick, but a reader who can page through 200 rows will assume there are 200. The footer says how many matched.                                                                                                                                                                                                                                     |
| Formatting is resolved against the field's unit              | Currency over a unitless number is a presentation with no correct answer. Refusing it by name beats a plain number that a claims reader reads as dollars anyway, off by a hundred.                                                                                                                                                                                                      |
| Markdown is a parser, not a renderer of HTML                 | The text widget is the one place configuration content reaches the DOM. Tokens to React elements has no HTML path at all, so there is no sanitiser to get wrong.                                                                                                                                                                                                                        |
| Layout collisions are per widget invalid, not a reflow       | A grid that reflows to fit a broken layout shows a dashboard nobody arranged, and the reader cannot tell which one they are looking at.                                                                                                                                                                                                                                                 |
| Recharts is lazy loaded behind a same size skeleton          | It is 380 KB of the bundle for a widget type a dashboard may not even use, and a skeleton that matches the chart keeps the layout still while it arrives.                                                                                                                                                                                                                               |
| Skeletons instead of spinners                                | A spinner says only that something is happening. A skeleton in the shape of the widget says what is coming and keeps the page from jumping when it arrives.                                                                                                                                                                                                                             |
| Widgets are placed at coordinates, not flowed in array order | A flow grid, where each widget carried a `colSpan` and took the next free space, made the dashboard depend on the order of the array: moving a widget in the file rearranged the page. `layout { x, y, w, h }` in v3 makes the arrangement explicit and reproducible, and the cost is a new failure mode, two widgets claiming one cell, which is handled as a per widget invalid tile. |

### Phase 5: filters

| Decision                                                        | Why                                                                                                                                                                    |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Values in the URL, one readable parameter per control           | A dashboard is something people send each other. One parameter per control survives being read, edited and pasted; a JSON blob survives none of those.                 |
| Defaults in the configuration, current values in the URL        | The author decides where a reader starts, the reader decides where they go, and neither overwrites the other.                                                          |
| Options come from the live data, not from the configuration     | A list written months ago describes the world as it was. Offering a value that no longer exists, or hiding one that does, is a quiet way to mislead.                   |
| A selected value that is gone from the data still applies       | Dropping it would widen the query behind the reader's back. Applying it and going honestly empty, with the control saying the value is not present, keeps the promise. |
| An invalid URL parameter falls back to the default and is named | Silently repairing a parameter answers a different question from the one the URL asked. Naming it lets the reader fix their own link.                                  |
| A skipped filter shows the widget unfiltered with a badge       | See the trade-off above: present and labelled beats absent, and one broken filter should not blank a whole dashboard.                                                  |
| The search box debounces the value, not just the URL write      | Debouncing only the URL still puts every keystroke in the query key, which is a request per character, each one cancelling the last.                                   |
| The filter bar loads, fails and recovers like a widget          | It reads from the same source the widgets read from. Pretending otherwise would leave a control confidently offering options it could not fetch.                       |

### Decisions on UI primitives

| Decision                                                                      | Why                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No component library, native elements first                                   | A `<select>`, a `<details>` and a `<fieldset>` already carry the keyboard and screen reader behaviour a library would re-implement, and they cost nothing to ship.                                          |
| Modal and toasts hand written rather than Radix or sonner                     | The two things actually needed are a dialog and a live region. `<dialog>` supplies the hard half of the first, and the second is twenty lines, so three dependencies buy little.                            |
| The chip group is a fieldset, not a labelled div, **later replaced entirely** | A `<label for>` pointing at a div names nothing, so the chips were grouped in a fieldset with a legend. Chips themselves then went: readable at four values, unusable at forty, and nothing to search.      |
| One searchable dropdown for every list that comes from data                   | A native select cannot be searched and chips cannot be scanned. Keeping the panel's contents native, radios and checkboxes, keeps selection and keyboard behaviour the browser's rather than reimplemented. |

### Phase 6: the editor

| Decision                                                       | Why                                                                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The draft is previewed through the loader, not a separate path | Any second rendering path for drafts would eventually disagree with the first, and the disagreement would show up as a widget that looked fine in the editor and broke on save.          |
| Layout changes are checked before they are applied             | The editor and the loader share one set of rules, so the editor cannot create a tile that the loader will call invalid. A refusal names the widget in the way.                           |
| Editor actions are addressed by position, not by widget id     | An entry broken enough to have no usable id still has to be editable and removable, and by id it would be unreachable.                                                                   |
| The form uses the loader's own schemas                         | One definition of a valid widget. A form schema that drifted from the loader's would let the editor save something the reader cannot open.                                               |
| A new widget starts with no binding and opens its editor       | Guessing a field would be a binding nobody asked for. An empty binding is honestly invalid, and the tile says so while it is being filled in.                                            |
| A binding to a field that is gone is kept and marked           | Clearing it loses what the author asked for and makes a broken widget look unfinished. Marked, it can be corrected or deliberately kept.                                                 |
| Every keystroke reaches the draft                              | The point of editing in place is to see the real state, including the ones that say the widget cannot render, before committing to it.                                                   |
| Save is shown disabled rather than hidden                      | A missing save button reads as a bug. A disabled one with a tooltip reads as a sequence.                                                                                                 |
| Widgets may override the dashboard dataset                     | The form asks for a dataset first, and a dashboard that can only ever read one source makes that question meaningless. The override is optional, so older configurations are unaffected. |

### Phase 7: persistence

| Decision                                                      | Why                                                                                                                                                                    |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compare and swap on every save                                | Last write wins loses work silently, which is the same failure as a stale number shown as live. A refusal costs a decision; the alternative costs someone's afternoon. |
| A conflict is an outcome, not an error                        | It is expected, it is not retryable, and treating it as a failure would either retry it or hide it behind a toast.                                                     |
| No automatic merge                                            | Merging two layouts without asking produces an arrangement neither person made. The diff is shown per widget and the choice stays with the reader.                     |
| Storage runs through the chaos transport                      | A save that is always instant and always succeeds would leave the pending, failed and refused states untested by the very reviewer who is meant to see them.           |
| The configuration is stored as text                           | It comes back in as input, through the same loader, so a hand edited record cannot take a different path into the renderer than a pasted one.                          |
| Revisions capped at 30, oldest pruned, and the cap is shown   | localStorage is a few megabytes per origin. An uncapped history is a quota failure waiting to happen, and a silent cap is a promise quietly broken.                    |
| Restore is a new save, not a rewrite                          | History that can be rewritten is not history. Restoring appends, so the version you restored from is still there afterwards.                                           |
| Another tab's save is news, never an action                   | Reloading on someone's behalf is the one move that can destroy unsaved work, so the banner offers reload only when there is no draft, and comparison when there is.    |
| Import lands as a draft, never as a save                      | A file is input from outside. It goes through the loader and then in front of a person, rather than straight over a stored dashboard.                                  |
| The store is an interface with an AbortSignal on every method | The localStorage implementation is a stand in for a backend. Writing the seams now means a REST version replaces one file rather than the UI.                          |

### Phase 8: the hostile corpus

| Decision                                                       | Why                                                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The corpus is run, not just shipped                            | A folder of nasty files proves nothing on its own. The runner turns each file into an assertion about what the loader does with it.                                 |
| The manifest is the source of truth, and the README follows it | Two lists that can disagree will. The runner fails if a file is missing from either, so they stay in step or the build stops.                                       |
| The app and the runner read the same files                     | A fixture copied into the app would drift from the one the test asserts on, and the drift would be invisible until it mattered.                                     |
| An invalid filter is dropped rather than fatal                 | Reversing a phase 2 decision: one mistyped filter kind costing every widget on the dashboard is a worse failure than the unfiltered data the original rule avoided. |
| Bidi controls are stripped and text is isolated in bdi         | A right to left override in a title rearranges the line around it, so a widget can be made to read as something it is not, with no script involved at all.          |
| The prototype check runs after the whole corpus                | Pollution is stateful: it is not enough for each file to be rejected, the process has to be clean once all of them have been through it.                            |

### Arranging the grid

| Decision                                                     | Why                                                                                                                                                                                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| react-grid-layout adopted for dragging and resizing          | A pointer drag that snaps to cells, a resize grip with minimum sizes, and push semantics are each a weekend of edge cases, and none of them is what this assessment is about. It is the only dependency added after the initial stack. |
| Refusing a colliding move, **replaced by pushing**           | The first editor refused any move onto an occupied cell, which was correct and unusable: a full row of metrics could not be rearranged at all, because every neighbouring cell was taken. A pointer drag now pushes.                   |
| The pointer pushes, the keyboard swaps or steps past         | Pushing is what a drag means, and the reader can see it happen. A key press that rearranged three tiles at the other end of the grid would be a change nobody watched, so a key press moves one tile and says what it did.             |
| Layouts are committed when a gesture ends, not while it runs | Committing every intermediate layout would mark a draft dirty as soon as the editor opened, and would write arrangements nobody chose. `onDragStop` and `onResizeStop` are the only commit points.                                     |
| Every arrangement is re-validated before it is applied       | The library decides where a tile goes; it does not decide what is valid. An arrangement that would not load is not applied, and the grid snaps back to the last one that would.                                                        |

## Guarantees and non-guarantees

What this system promises, in one place. Each line is explained somewhere above.

**Guarantees**

- A widget shows current data, or it shows what is wrong with it. There is no third state.
- One bad widget cannot take down the dashboard around it: validation, binding resolution,
  rendering and crashes are all per widget.
- A configuration is never partly applied. Either the dashboard loads and every widget reports
  its own verdict, or the load fails with a reason and the original text on screen.
- Stale data is labelled with the time it was fetched and the failure that stopped the refresh,
  and is never presented as current.
- Empty is distinguished from zero. A missing value is never rendered as `0`.
- An answer to a question that is no longer being asked cannot appear on screen: every input to
  the answer is in the query key.
- A save never silently overwrites another save. Compare and swap refuses, and the conflict is
  shown per widget with the choice left to a person.
- A failed save leaves the draft exactly as it was, and says so.
- History is append only. Restoring a revision writes a new one.
- The editor cannot produce a configuration the reader's loader would reject: same schemas, same
  placement rules, same loader for the preview.
- Configuration text cannot reach the DOM as markup: no HTML path, no links, no images, bidi
  controls stripped, `dangerouslySetInnerHTML` banned by lint.
- Every failure is reachable on purpose: latency, refusals, timeouts, corruption, renamed fields,
  retyped fields and dropped datasets are all controls, not accidents.

**Non-guarantees**

- No live collaboration. No presence, no shared cursors, no streaming edits.
- No automatic merge. A conflict is a decision, not an algorithm.
- No sharing between browsers or machines: storage is localStorage, per browser and per origin.
- No authentication, no authorisation, no audit trail. Every reader here is the same person.
- No server side aggregation: the data layer is in memory, and a table sees a bounded window of
  rows rather than an unbounded result set.
- No guarantee that a dashboard renders identically at every viewport. The grid is responsive in
  width only; twelve columns on a phone is a known gap.
- No offline queue. A save that fails is retried by a person, not by a background worker.
- No protection against a reader who edits their own localStorage: it is read back as input and
  reported honestly, which is not the same as being tamper proof.

## Security

The threat model here is **a configuration is untrusted input**, whoever it came from: a URL, a
file, storage, or an earlier version of this app. The defences are spread through the document,
so they are gathered here with pointers.

| Surface                       | What is done                                                                                                                                                                                                               | Where                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Script injection through text | The text widget parses a tiny markdown subset to React elements. No HTML path, no links, no images, so a `javascript:` URL has nowhere to go. `dangerouslySetInnerHTML` is banned by lint.                                 | Rendering, per widget decisions       |
| Prototype pollution           | `__proto__`, `constructor` and `prototype` are rejected as keys anywhere in a document, and as binding field names, before validation runs. The hostile runner asserts `Object.prototype` is clean after the whole corpus. | The load pipeline, the hostile corpus |
| Denial of service by document | Size, depth, widget count, filter count and string lengths are all capped before validation. The depth walk is iterative, so a deep document cannot exhaust the stack on its way to being rejected.                        | Limits                                |
| Visual spoofing               | Bidi control characters are stripped and configuration text renders inside `<bdi>`, so a title cannot reorder the line around it.                                                                                          | The hostile corpus                    |
| The URL as input              | Every filter parameter is validated with the same zod schemas the configuration uses. An invalid one is ignored, named, and removed from the address bar.                                                                  | The URL is input                      |
| Storage as input              | Stored records are validated on read and the configuration inside them goes through the same loader as a pasted one. Corrupt storage is a screen with a reason.                                                            | Persistence                           |
| Responses as input            | The data layer validates its own payloads against zod schemas, and the corrupt-next-response control exists to prove it.                                                                                                   | The data layer                        |

What is **not** covered: there is no server, so there is no authentication, no authorisation, no
rate limiting and no CSRF surface. A reader can edit their own localStorage and their own URL, and
the answer to both is the same, they are read back as input.

## Accessibility

- **Native elements first.** `<select>`, `<details>`, `<fieldset>`, `<table>` with `aria-sort`,
  `<dialog>`, real `<button>`s. Where a control is hand written, the parts a person interacts
  with are still native: the searchable dropdown is a trigger button and a panel of radios or
  checkboxes.
- **Dialogs** come from `<dialog>` with `showModal()`, which supplies the top layer, the inert
  background, the focus trap and Escape. The wrapper adds the backdrop click, focus returning to
  whatever opened it, the page lock behind it, and `aria-labelledby` and `aria-describedby`.
- **Toasts** live in two live regions that exist from the first render: successes are polite,
  failures are assertive. Each has a dismiss button, and the countdown pauses on hover and on
  focus, so a message cannot vanish while it is being read.
- **Colour never carries meaning alone.** Every state badge is an icon plus words, and selected
  options carry a check as well as a fill.
- **Arranging works without a pointer.** Toolbar arrows on the selected tile, and the arrow keys
  while focus is anywhere in the tile, both do what a drag does. Every keyboard arrangement is
  announced in a polite live region, including the presses that do nothing because the tile is
  against the edge of the grid.
- **Failure states are announced.** Error and warning panels carry `role="alert"`; the filter
  bar's notices and the cross tab banner are `<output>` elements, which are polite live regions.

Known gaps, stated rather than hidden:

- **react-grid-layout's drag handle and resize grip are pointer only.** The keyboard path exists
  alongside them and is tested, but the two are not the same control, so a keyboard user and a
  pointer user are doing different things to reach the same result.
- **The searchable dropdown is a disclosure, not a listbox.** Tab reaches the trigger, then the
  search box, then each option in turn; there is no roving `tabindex`, no arrow key navigation
  between checkboxes, no typeahead, and opening it does not move focus into the panel. Native
  radios do get arrow keys, which makes single select better off than multi select here.
- **No focus trap inside the dropdown panel**: Tab can leave it while it is open, which closes it
  on the next outside pointer event but not on the Tab itself.
- **The dashboard is responsive in width only.** Twelve columns are twelve columns on a phone.
- **No reduced motion handling** for the grid's drag transitions.
- **Charts are pictures.** Recharts renders SVG with tooltips, and the underlying numbers are not
  exposed as a table for a screen reader.

## What I would do next

Distinct from the known limits above, which are deliberate. These are the things that are missing
because the clock ran out.

1. **Make the dropdown a real listbox**: roving `tabindex`, arrow keys, typeahead, focus moved
   into the panel on open. It is the largest accessibility gap and the one most likely to be hit.
2. **Page the table at the data layer** so the row window stops being a cap, and each page is its
   own request with its own loading, error and stale states.
3. **A widget level "explain this number"**: the query that produced it, the filters applied, the
   rows matched, the time fetched. Most of the pieces are already on the tile; they are not in one
   place.
4. **Per widget refresh intervals**, with the same honesty about staleness that the manual path
   has.
5. **A REST implementation of the store interface**, which is the one file that stands between
   this and real sharing, plus the conflict path exercised against a server clock rather than a
   tab.
6. **Reduced motion and a narrow viewport layout**, both of which are currently assumptions rather
   than decisions.
7. **A performance pass with a large configuration**: fifty widgets against a slow source, to find
   out whether the per widget query fan out needs batching.

## Known limits

Things that are deliberate rather than unfinished, and what each one would take to lift.

| Limit                                                  | Why it is here                                                                                                                                     | What lifting it needs                                                                                                 |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A table sees the first 200 matching rows               | Sorting and paging happen in the browser, so the window has to be bounded. The footer states the total, so the cap is visible rather than implied. | Paging at the data layer: the table asks for the page it is on, and each page is its own request with its own states. |
| The table is not virtualised                           | It paginates, so 8 to 100 rows are in the DOM. A virtualiser would add a dependency and a scroll container to save nothing.                        | Only worth it alongside dropping pagination for one long list.                                                        |
| History is capped at 30 revisions per dashboard        | localStorage is a few megabytes for the whole origin.                                                                                              | A backend, where history is not competing with everything else in the browser.                                        |
| Sharing works within one browser                       | localStorage is per browser and per origin.                                                                                                        | A REST implementation of the store interface, which is one file.                                                      |
| Charts cap at 8 series when grouping                   | More lines than that stop being readable, and a chart that cannot be read is not showing the truth either.                                         | Nothing technical; it is a readability decision.                                                                      |
| The demo world is generated from a fixed seed and date | Two reviewers should see the same numbers, and the shipped date filters should keep matching data.                                                 | Generating relative to now, at the cost of reproducibility.                                                           |

## Open questions

- How stale is stale: a fixed age, or per widget and configurable?
- Whether an unresolvable binding reads better as a configuration problem or a data problem on the
  tile, given that a field can disappear long after the configuration was valid.
- Whether a widget that ignores a filter should say so on the tile, since a reader comparing two
  tiles under the same filter bar has no other way to know.

## Appendix: how this was built

Nine phases, each one ending with a green `npm run check` and a commit. This document was written
along the way rather than reconstructed afterwards, which is why the decision log records a few
decisions that were later reversed, with the reversal and the reason.

| Phase                                     | State       |
| ----------------------------------------- | ----------- |
| 1. Project setup                          | Done        |
| 2. Config schema, migrations, tests       | Done        |
| 3. Data layer, chaos controls, fetch hook | Done        |
| 4. Rendering and the four widget types    | Done        |
| 5. Dashboard filters                      | Done        |
| 6. Widget editor                          | Done        |
| 7. Persistence, revisions, conflicts      | Done        |
| 8. Hostile configuration corpus           | Done        |
| 9. Documentation and self-review          | In progress |

Outstanding at the time of writing: the README's instructions for exercising the system, and the
self review. Everything above describes what is in the repository now.
