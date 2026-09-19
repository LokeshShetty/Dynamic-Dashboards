# Independent review

A second assistant, given the brief and the promise and nothing else, asked to find what would
block a merge. It had not seen the build session and was told to assume nothing in the repository
was correct. The first message below is the whole brief it was given, so what it was steered
towards is visible rather than implied.

Eleven findings came back. Every one was reproduced before it was acted on: seven were fixed,
three are written up in `SELF_REVIEW.md` with reproductions, and one was dropped as a nit.

Tool results are omitted: they are file contents and command output, all of which are in the
repository already. Everything the reviewer said is here, in order, with its tool calls named
where they happened.

| | |
| --- | --- |
| Replies | 43 |
| Tool calls | 40 |
| Ran | 2026-09-19 |

---

### Task · 2026-09-19 06:10:42

You are reviewing a take-home submission before it is merged. You have not seen how it was built and you should not assume anything is correct. Be adversarial and specific.

REPO: /Users/personal/Desktop/custom-dashboard (read it directly; do not modify anything)

THE BRIEF it was built against:
"Design and build the component responsible for turning a user-authored configuration into a live, correct, resilient dashboard. This assessment focuses on how the system handles configurations that are old, wrong, hostile, or describe a world that no longer exists. Capabilities: a widget catalogue, composition, binding and configuration, dashboard-level filters, rendering saved configurations against live data, and persistence, sharing and revision. Operational conditions: configuration is adversarial and potentially malformed; data moves, fields are renamed and types change; everything is slow and some requests fail; multiple users may edit or view the same dashboard concurrently."

THE PROMISE the author claims to keep:
"Every widget is either showing the truth or visibly showing that it cannot."

YOUR TASK: find the most serious issues a reviewer would block the merge on. Not nits, not style, not "needs more tests", not missing features that are documented as out of scope. Only things that are wrong, unsafe, or that break the promise.

Look hard at these four areas specifically:

1. SECURITY
   - src/dashboard/_lib/markdown.ts and the text widget: can anything reach the DOM as markup? Check the regex for catastrophic backtracking on adversarial input.
   - URL parameter handling in src/dashboard/_lib/filter-params.ts and the nuqs parsers.
   - The storage read path in src/storage/_lib/ : what happens with hand-edited localStorage?
   - Import in src/dashboard/_components/dashboard-transfer.tsx.
   - Prototype pollution: src/dashboard/_lib/guard.ts. Is the walk actually exhaustive? Is there a way round it?

2. DATA CORRECTNESS (this is the area most likely to hide a real bug)
   - src/data/_lib/execute-query.ts: aggregates over null and undefined. What does avg do when some values are null? What does count count? Are min and max correct for dates and for mixed types? Is sum over an empty set 0 or null, and is that the honest answer?
   - Currency: src/dashboard/_lib/format.ts divides cents by 100. Check rounding and the interaction with the "decimals" option.
   - Filter semantics: does an empty multi-select mean "all" or "none"? Is that consistent between the URL, the query and the UI?
   - Dates and timezones: the date-range filter builds ISO strings; the week bucketing in execute-query uses getUTCDay. Is there an off-by-one or a local-vs-UTC mismatch that would put a row in the wrong week or exclude a row at a boundary?

3. CONCURRENCY
   - src/storage/_lib/local-dashboard-store.ts: the compare-and-swap does read-then-write on localStorage. What happens if two tabs save at the same moment? Is the window real, and what is the consequence?
   - src/storage/_lib/broadcast.ts: message ordering and the storage-event fallback.
   - Revision pruning when the cap is hit.

4. THE RACE TEST
   - src/dashboard/_hooks/use-widget-data.test.tsx claims to prove a slow answer to an old question cannot land on screen after the question changed. Does it actually prove that, or does it pass for an incidental reason? Would it fail if the invariant broke?

For each issue you find, report:
- file:line
- what is wrong, concretely
- a reproduction: exact input or steps that trigger it
- impact: what a user sees or loses
- whether it breaks the stated promise

Rank them by severity. If an area is genuinely fine, say so in one line rather than inventing something. You may run `npx vitest run <file>` or write throwaway scripts under /tmp to check a hypothesis, but do not modify the repo.

Return: a ranked list of findings, each with the fields above, and a one-line verdict per area.

**Assistant**

I'll start by mapping the repo and reading the specific files called out.

**Assistant**

`↳ Bash` List source files and package.json

**Assistant**

`↳ Read` /Users/personal/Desktop/custom-dashboard/src/dashboard/_lib/markdown.ts

**Assistant**

`↳ Bash` Read text widget, filter params, guard, format

**Assistant**

`↳ Bash` Read execute-query

**Assistant**

`↳ Bash` Read query builder, data constants, filter controls

**Assistant**

`↳ Bash` Read config schema

**Assistant**

`↳ Bash` Check Intl currency/percent behavior

**Assistant**

`↳ Bash` Read storage layer

**Assistant**

`↳ Bash` Read use-widget-data and its test

**Assistant**

`↳ Bash` Read transport and client

**Assistant**

`↳ Bash` Read chaos slice and store

**Assistant**

`↳ Bash` Read transfer, constants, guards, load-config

**Assistant**

`↳ Bash` Read save hooks

**Assistant**

`↳ Bash` Read chaos url, effective dataset, corrupt

**Assistant**

`↳ Bash` Read metric widget, table columns, error boundary

**Assistant**

`↳ Bash` Read world dataset definitions

**Assistant**

`↳ Bash` Read widget renderer and widget state

**Assistant**

`↳ Bash` Check aggregate constraints in editor

**Assistant**

`↳ Bash` Read chart widget and find error boundary usage

**Assistant**

`↳ Bash` Read widget frame

**Assistant**

`↳ Bash` Read aggregatesFor and table widget

**Assistant**

`↳ Bash` Check tree above widget renderer for boundaries

**Assistant**

`↳ Bash` Time markdown regex on adversarial input

**Assistant**

`↳ Bash` Read bidi-text, use-revision, seed

**Assistant**

`↳ Bash` Read filter values hook and notices

**Assistant**

`↳ Bash` Read migration code

**Assistant**

`↳ Bash` Read draft slice and diff

**Assistant**

`↳ Bash` Read loaded dashboard

**Assistant**

`↳ Bash` Trace ignoredFilterIds usage

**Assistant**

`↳ Bash` Inspect fixtures and hostile config loading

**Assistant**

`↳ Bash` List hostile corpus and read number format fields

**Assistant**

`↳ Bash` Run the test suite

**Assistant**

`↳ Bash` Run the test suite

**Assistant**

`↳ Bash` Find create callers and read editor hook

**Assistant**

`↳ Bash` Read dashboard route

**Assistant**

`↳ Bash` Read not-found create and editor save path

**Assistant**

`↳ Bash` Find save call sites

**Assistant**

`↳ Bash` Verify proto key visibility and read hostile fixture

**Assistant**

I have enough to write this up. Let me do one last confirmation on two claims.

**Assistant**

`↳ Bash` Confirm router error element and nullable fields

**Assistant**

`↳ SubagentHandback`

**Assistant**

Review delivered. Summary of what I found:

**Three blockers**, all breaking the stated promise:
1. `ignoredFilterIds` is dead code — the opt-out parameter on `toDataFilters` is never passed by its only caller, so widgets declaring they ignore a filter are filtered anyway, silently.
2. A schema-valid 3-char currency code (`US1`, `GB£`) throws `RangeError` from `resolveFormatter`, called in the component body *outside* `WidgetErrorBoundary` — so it takes down the whole `/d/:id` route, not the tile.
3. `metric-widget.tsx:74` refuses `min`/`max`/`first`/`last` over date and text fields with a false reason, contradicting both the query engine and the editor's own aggregate dropdown.

Plus two high-severity silent-wrong-number bugs (`count` counting non-nulls against a row-count caption; "No data" asserting no rows matched when thousands did), a `percent` format with no unit guard that multiplies by 100, a genuinely non-atomic localStorage CAS that reports lost updates as success, and several medium findings in URL filter round-tripping and the v2→v3 migration.

Areas I found genuinely clean: security (no markup path, no ReDoS — I timed it, prototype guard is exhaustive), dates/timezones (consistently UTC end to end), and the race test, which does prove its invariant and would fail if the key composition broke.
