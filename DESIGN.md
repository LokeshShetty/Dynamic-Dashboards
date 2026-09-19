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
| 5. Dashboard filters                      | Done        |
| 6. Widget editor                          | Done        |
| 7. Persistence, revisions, conflicts      | Done        |
| 8. Hostile configuration corpus           | Done        |
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
parsers. A parameter that does not validate is ignored, the configured default is used in its
place, and the bar says which parameter it dropped and why:

> Ignored `f_submitted_from`=`not-a-date`: invalid ISO date. Using the configured default instead.

A date range needs both ends. A half range falls back to the configured other end, and says so
when there is none. A range that ends before it starts is refused rather than swapped, because
swapping would silently answer a question nobody asked. None of these paths can crash the page.

### Options come from the data, not the configuration

`select` and `multi-select` offer the values the field actually holds right now, fetched through
the same client as everything else, which means they are slow, they can fail, and a renamed field
takes the options away. So the bar is treated as a data surface in its own right:

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

The header says whether there are unsaved changes. Discarding asks first, and leaving edit mode
with a dirty draft asks too, because until persistence lands there is nowhere for the draft to go.
Save is present and visibly disabled with a tooltip saying what it is waiting for: a dashboard
editor with no save button reads as broken.

### Adding and arranging

The catalogue offers the four widget types. A new widget takes the first free slot on the grid at
a default size for its type, and the editor opens on it immediately: bindings are left empty
rather than guessed, so until a field is chosen the tile says it is not configured yet.

Each tile carries a toolbar: move handle, rename, edit, duplicate, move, resize, remove. Every
control is an icon button with a name that says which widget it acts on. Remove goes through the
confirm dialog. The same moves work from the keyboard while focus is anywhere in the tile: arrows
move, shift and arrows resize, and the move handle is the focus target that announces both the
current position and how to change it.

**Every layout change is checked before it is applied**, against the same rules the loader
validates against: inside the grid, within the row limit, and not on top of another tile. A
refused change is not applied and says why, naming the widget in the way: _Move refused, that
would sit on top of "Claims"_. The editor cannot produce a layout that the loader would then
report as invalid.

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

`react-grid-layout` does the dragging and resizing. It is the only dependency in the project
taken on for a feature rather than for tooling, and it is approved in CLAUDE.md for three things
the browser's own primitives do not give:

- a pointer drag that snaps to grid cells, with a placeholder showing where the tile will land;
- a resize grip with per widget minimum sizes;
- **push and compact semantics**: growing a tile moves the ones below it down rather than landing
  on top of them, and dragging is not bounded by the current content height, so a tile can be
  taken into new space below the last row.

dnd-kit was the obvious alternative and was rejected on the facts: it does no resizing at all and
no grid snapping, so it would have removed neither piece of the work.

### Arranging without a pointer

**The library's drag handle and resize grip are pointer only.** They are not the accessible path
and were never meant to be. The accessible path is the toolbar arrows, which appear on the tile
being worked on, and the arrow keys, which do the same two jobs while focus is anywhere in the
tile: arrows move, shift and arrows resize. Both still work with the library in place, and both
are verified against the shipped demo at `/d/demo?edit=1`.

The keyboard and the pointer differ in one way, deliberately. A drag pushes the tiles it lands on
out of the way, because that is what a pointer gesture means. A keyboard step does not push: two
tiles of the same size trade places, a smaller one is stepped past to the first free space, and
the edge of the grid is silent. Pushing on a single key press would rearrange a dashboard several
tiles away from the one the reader is holding, with no way to see it happen.

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

There is no component library in this project. Every control is a native element styled with
Tailwind tokens, and the handful of things with no native equivalent are written by hand into
`src/components/ui/` in the shadcn style, one file per primitive.

| Surface               | Built from                                                         |
| --------------------- | ------------------------------------------------------------------ |
| Select filter         | `<select>`                                                         |
| Multi-select filter   | Toggle `<button aria-pressed>` chips inside a `<fieldset><legend>` |
| Date range filter     | Two `<input type="date">`                                          |
| Search filter         | `<input type="search">`                                            |
| Widget configuration  | `<details>` and `<summary>`                                        |
| Table                 | `<table>` with `aria-sort` and header buttons                      |
| Modal, confirm dialog | `<dialog>` with `showModal()`, wrapped in `src/components/ui`      |
| Toasts                | Two `aria-live` regions over a Zustand slice                       |

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

| Decision                                                  | Why                                                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No component library, native elements first               | A `<select>`, a `<details>` and a `<fieldset>` already carry the keyboard and screen reader behaviour a library would re-implement, and they cost nothing to ship.               |
| Modal and toasts hand written rather than Radix or sonner | The two things actually needed are a dialog and a live region. `<dialog>` supplies the hard half of the first, and the second is twenty lines, so three dependencies buy little. |
| The chip group is a fieldset, not a labelled div          | A `<label for>` pointing at a div names nothing. A fieldset with a legend gives the group a real accessible name, which is what a screen reader reads before the chips.          |

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

## Open questions

- How stale is stale: a fixed age, or per widget and configurable?
- Whether an unresolvable binding reads better as a configuration problem or a data problem on the
  tile, given that a field can disappear long after the configuration was valid.
- Whether a widget that ignores a filter should say so on the tile, since a reader comparing two
  tiles under the same filter bar has no other way to know.
