# Configurable dashboard

## Summary

This is the dashboard layer that turns a user-authored, versioned JSON configuration into a live
dashboard, built around one promise: every widget is either showing the truth or visibly showing
that it cannot. The work is not in the happy path but in everything around it, so the
configuration is treated as untrusted input at every entry point, the data layer is slow and
fails on purpose, and two tabs are treated as two users. Where a trade-off existed, the option
that keeps the promise won, and each one is recorded with its reason in `DESIGN.md`. A reviewer
can break it from the chaos panel, the query string or the console without touching the code.

## What changed

- **Configuration layer.** One entry point, `loadDashboardConfig(text)`: size and shape guards,
  `JSON.parse`, migration, dashboard validation, then each widget and each filter validated on
  its own. Format v3, with v1 and v2 migrated forward and both shipped as seeded dashboards.
- **Data layer.** Three seeded synthetic datasets served by an async client that honours
  `AbortSignal`, times out at 8 seconds, validates its own payloads, and exposes each dataset's
  schema, which chaos can rename, retype or delete underneath a saved dashboard.
- **Chaos controls.** Latency, jitter, failure rate, timeout rate, corrupt next response, and the
  three world mutations, driven from a panel, `?latency=…&failRate=…`, or `window.__chaos`.
- **Rendering.** One seven state union rendered by one `WidgetFrame`, per widget error
  boundaries, skeletons shaped like the widget that is coming, and four widget types: metric,
  table, chart, text.
- **Filters.** Four kinds, values in the URL one readable parameter per control, options fetched
  from the live data, and a filter that cannot apply leaves the widget visibly unfiltered rather
  than blank.
- **Editor.** `?edit=1` on the same page, a draft previewed through the reader's own loader, a
  form over the loader's own schemas, and drag, resize and keyboard arranging that cannot produce
  a layout the loader would reject.
- **Persistence.** A store interface over localStorage behind the same chaos transport, compare
  and swap on every save, a conflict view with three outcomes and no automatic merge, revisions
  capped at 30, import and export.
- **Cross tab.** Saves announced over `BroadcastChannel` with a storage event fallback, validated
  with zod, shown as news and never acted on for the reader.
- **Hostile corpus.** 23 configurations written to break the renderer, run by
  `src/hostile-configs.test.ts` against a manifest, and loadable in the app from the same files.
- **Docs.** `DESIGN.md` with the format, guarantees and non-guarantees, security, accessibility,
  a decision log that keeps its reversals, and known limits. `SELF_REVIEW.md` with the three
  issues I would block this on.

## Test plan

**Automated**, from a clean clone (this is exactly what I ran):

```sh
git clone <this repo> dashboard && cd dashboard
npm ci                 # Node 20 or newer, .nvmrc pins 22
npm run check          # typecheck, oxlint, prettier, vitest, build
npm run build          # main chunk 774 kB, chart and hostile files are separate chunks
npm run dev            # then follow README.md
```

`npm run check` is green on the tip commit. Two test files on purpose: the hostile corpus runner
(24 assertions over the folder plus a prototype pollution check) and the race test that proves a
slow answer to an old question cannot land on screen after the question changed.

**Verified against a rendered app** in jsdom harnesses while building each phase, then deleted
rather than kept, per the testing decision in `CLAUDE.md`:

- rename `amount_cents`: the money metrics and the weekly chart report an unresolvable binding by
  name, the claim count keeps working, the table loses one column and keeps four;
- currency over a field with no money unit, and a sum over a text field, both refused on the tile
  with the reason;
- one malformed widget leaves its neighbours alone; overlapping layouts mark the later widget;
- `?f_submitted_to=2024-09-15` is reported, dropped from the URL, and the control keeps the
  configured default;
- a filter whose field is renamed leaves every widget visibly unfiltered;
- saving with a stale version opens the conflict view with all three choices;
- a failed save keeps the draft dirty and offers a retry;
- `?rev=1` opens read only with restore;
- keyboard arranging swaps, steps past, and announces the edge of the grid.

**To click through in a browser** (`npm run dev`, then `README.md` has the same list):

1. `/d/demo`, refresh a few times to meet the failure and retry states at the default 10 percent.
2. `__chaos.renameField('claims', 'amount_cents', 'amount_cents_v2')`, then `restoreWorld()`.
3. `__chaos.changeFieldType('claims', 'submitted_at', 'text')` for the unfiltered badges.
4. `__chaos.corruptNextResponse()` then refresh one tile.
5. **Two tab conflict**: `/d/demo?edit=1` in two tabs, save from A, watch B say _someone saved
   version N_, then save from B and resolve the conflict. This one genuinely needs two tabs; the
   automated coverage simulates the other tab rather than being one.
6. **Hostile picker**, from the chaos panel: `duplicate-ids.json`, `overlapping-layout.json`,
   `xss-title-and-text.json`, `unicode-rtl-override-title.json`, `prototype-pollution.json`,
   `five-thousand-widgets.json`, and `v1-legacy.json`, which is the only one that opens cleanly.

## Known issues

[SELF_REVIEW.md](SELF_REVIEW.md) lists the three I would block on, each with a reproduction, the
fix and why it is not in this branch: concurrent saves can still lose one write between tabs,
filter values containing a comma are split in the URL, and filter ids that collide after the
date range suffix drive each other. Seven other findings from the same review are fixed on this
branch and named there with their commits. It ends with one that is not a defect yet: the table
holds every cell it renders, and only the row, page and column caps keep that small.

`DESIGN.md` has a **Known limits** section for the things that are deliberate rather than
unfinished: the 200 row table window, no virtualisation, the 30 revision cap, sharing within one
browser, the eight series cap on grouped charts, and the fixed seed behind the demo data.

## Out of scope

- No backend. Persistence is localStorage behind an interface written so a REST implementation
  replaces one file. Real sharing between machines needs that backend.
- No live collaboration, no CRDT, no automatic merge: a conflict is a decision a person makes.
- No authentication, authorisation or audit trail.
- No server side aggregation: the data layer is in memory, and the table reads a bounded window.
- Responsive in width only. Twelve columns are twelve columns on a phone.
- The dropdown is a disclosure rather than a listbox: no roving tabindex, no typeahead. It is the
  first item in `DESIGN.md`'s "What I would do next".

## AI tools

AI tools were used throughout: the work was done in a series of assistant sessions, one per
phase, each ending with a green `npm run check` and a commit. See [transcripts/](transcripts/).
The commit history is the honest record of the order things happened in, including the decisions
that were later reversed, which `DESIGN.md` keeps rather than tidies away.
