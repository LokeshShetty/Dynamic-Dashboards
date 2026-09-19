# Configurable Dashboard

A dashboard layer that turns a user-authored, versioned JSON configuration into a live dashboard,
built around one promise:

> Every widget is either showing the truth or visibly showing that it cannot.

The interesting part is not the happy path. It is what happens when the configuration is old,
malformed or hostile, when fields are renamed or change type under the renderer, when the data
layer is slow or failing, and when two tabs edit the same dashboard at once.

- [DESIGN.md](DESIGN.md): the configuration format, the guarantees and non-guarantees, security,
  accessibility, the decision log, and the known limits.
- [hostile-configs/](hostile-configs/README.md): 23 configurations written to break the renderer,
  every one of them run by the test suite.
- [SELF_REVIEW.md](SELF_REVIEW.md): the three most serious issues I would block my own PR on.

## Getting started

Node 20 or newer (`.nvmrc` pins 22; developed on 25).

```sh
npm ci        # npm install also works
npm run dev
```

The app opens on `/d/demo`. Three dashboards are seeded into localStorage on the first visit:

| Route          | What it is                                                             |
| -------------- | ---------------------------------------------------------------------- |
| `/d/demo`      | Eight widgets over the `claims` dataset, written in the current format |
| `/d/legacy-v2` | The same dashboard in configuration format 2, migrated on the way in   |
| `/d/legacy-v1` | Format 1, migrated forward twice. The oldest thing that still opens    |
| `/d/anything`  | An id that does not exist: a dead end with a way forward               |

## Making it fail on purpose

**Nothing here is instant or reliable by default.** Every request, including saving, runs through
the same transport: about 1.2 seconds of latency with jitter, a 10 percent failure rate and a 2
percent timeout rate. So loading, retry, error and stale states turn up on their own.

There are three ways to make it worse, all driving the same store.

**The chaos panel**, bottom right of any dashboard. Latency, jitter, failure rate, timeout rate,
corrupt the next response, rename a field, change a field's type, drop a dataset, reset the
stored dashboards, and the hostile configuration picker. When any setting differs from the
default, a chip next to the button says which.

**The query string**, so a link can carry the conditions:

```
/d/demo?latency=4000&jitter=0&failRate=0.5&timeoutRate=0.2
```

**The console**, `window.__chaos`:

```js
__chaos.set({ latencyMs: 4000, failureRate: 0.5 }) // slow and unreliable
__chaos.corruptNextResponse() // the next payload comes back malformed
__chaos.renameField('claims', 'amount_cents', 'amount_cents_v2') // binding drift
__chaos.changeFieldType('claims', 'amount_cents', 'text') // type drift
__chaos.dropDataset('claims') // the dataset stops existing
__chaos.restoreWorld() // undo the three above
__chaos.reset() // back to defaults
__chaos.get() // what is in force now
```

### Five minutes that cover most of it

1. **Open `/d/demo`** and watch the tiles load. Refresh a few times: with a 10 percent failure
   rate you will see `Cannot load` with a reason and a retry, and `retrying (n/3)` on the badge.
2. **Rename a field**: `__chaos.renameField('claims', 'amount_cents', 'amount_cents_v2')`. The
   two money metrics and the weekly chart say the field is not in the dataset any more; the claim
   count keeps working; the table loses one column and keeps the other four.
3. **Change a type under a filter that is in use.** The date range is the only filter applied by
   default, so run `__chaos.changeFieldType('claims', 'submitted_at', 'text')`: every widget
   carries an `Unfiltered` badge and says the filter needs a date field. The same happens with
   `status` once you have chosen one in the Status filter.
4. **Corrupt a response**: `__chaos.corruptNextResponse()` then refresh a tile. The payload fails
   its own schema and the tile says so rather than rendering it.
5. **Go slow, then fail**: `__chaos.set({ latencyMs: 12000 })` and refresh a tile to sit in the
   skeleton until the 8 second timeout fires. Then `__chaos.set({ latencyMs: 0, failureRate: 1 })`
   and press a tile's refresh: it keeps the numbers it already had and labels them **stale since
   HH:MM:SS** with the reason the refresh failed.

### Hostile configurations

The chaos panel has a picker that loads any file from [hostile-configs/](hostile-configs/) in
place of the stored dashboard, read only. It is the same file the test runner asserts on, read
through the same module. Try `duplicate-ids.json`, `overlapping-layout.json`,
`xss-title-and-text.json`, `unicode-rtl-override-title.json`, `prototype-pollution.json`,
`five-thousand-widgets.json`, and `v1-legacy.json`, which is the only one expected to open
completely fine.

### Two tabs are two users

1. Open `/d/demo?edit=1` in two tabs.
2. In tab A, add a widget and save. Tab B says **someone saved version N**, with a reload button
   if it has no unsaved work of its own.
3. In tab B, change something and save. The save is refused: a conflict view lists what differs
   per widget and offers **keep editing**, **reload theirs**, or **overwrite** through a
   confirmation. Nothing merges automatically and nothing is overwritten silently.

### Editing, history and files

- **Edit dashboard** puts `?edit=1` on the URL. Drag a tile by the handle in its toolbar, resize
  from the corner, or use the arrow keys while focus is in the tile (shift and arrows resize).
  Every arrangement is checked against the loader's rules before it is applied.
- **Save** is enabled only when the draft differs from what is stored, and reads _Saved_ when it
  does not.
- **`?rev=N`** opens a past revision read only, with a banner saying which of how many. Restoring
  writes a new revision rather than rewriting history, which is capped at 30 per dashboard.
- **Export** downloads the stored configuration, **Sample** downloads a small valid one, and
  **Import** runs a file through the same loader as everything else and lands it as an unsaved
  draft to review.

## Scripts

| Script                 | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Vite dev server                                           |
| `npm run typecheck`    | `tsc -b`, TypeScript in strict mode                       |
| `npm run lint`         | oxlint                                                    |
| `npm run format:check` | Prettier in check mode, which also enforces import order  |
| `npm run test`         | Vitest: the hostile corpus runner and one race test       |
| `npm run build`        | Production build                                          |
| `npm run check`        | All of the above in that order, green before every commit |

Two test files, on purpose: `src/hostile-configs.test.ts` runs every hostile configuration
against its manifest, and `src/dashboard/_hooks/use-widget-data.test.tsx` proves a slow answer to
an old question cannot land on screen after the question changed.

## Stack

Vite, React 19, TypeScript strict, Tailwind v4 with cva and `cn`, TanStack Query, React Router,
nuqs for URL state, React Hook Form with zod, Recharts, Zustand, react-grid-layout for dragging
and resizing, Vitest with React Testing Library. No component library: the UI primitives are
native elements and a few hand written ones in `src/components/ui/`.

AI tools were used while building this. The session transcripts are in [transcripts/](transcripts/).
