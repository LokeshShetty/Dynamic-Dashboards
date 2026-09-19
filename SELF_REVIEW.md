# Self review

An independent reviewer went through this branch without knowing how it was built, looking for
things that would block a merge across security, data correctness, concurrency, and whether the
race test proves what it claims. Eleven findings came back. I reproduced every one of them before
acting on it, fixed seven, and dropped the last as a nit.

Fixed on this branch, in the commits named:

| What                                                                      | Commit    |
| ------------------------------------------------------------------------- | --------- |
| A three character currency code the schema allows crashed the whole route | `65994c0` |
| `ignoredFilterIds` was validated, stored, displayed, and never read       | `0aa11b1` |
| A metric refused aggregates the engine computes and the editor offers     | `2442938` |
| `count` counted values while the caption counted rows                     | `2442938` |
| "No data" blamed the filters when the column was simply empty             | `2442938` |
| A v2 dashboard could migrate into a layout v3 rejects                     | `fb82711` |
| A concurrent save could be lost and reported as a success                 | `5026bf3` |

Below are the three most serious that remain, then one that is not a defect yet and will be.

---

## 1. Two tabs saving in the same moment can still lose one of the two saves

**What it is.** `localStorage` has no compare and swap. `save()` in
`src/storage/_lib/local-dashboard-store.ts` reads the stored record, compares its version, and
then writes, which is two operations that another tab can interleave with. Two tabs that both
read version 5 both pass the check and both write version 6, and the second write wins.

Commit `5026bf3` reads the write back and reports a conflict when what landed is
not what was written, so the loser is no longer told "Saved" while its work disappears. **The
overwrite itself still happens**, and the losing revision goes with it: revisions live inside the
same JSON blob that was replaced, so `?rev=N` cannot recover the clobbered save.

**How to reproduce.** Open `/d/demo?edit=1` in two tabs, set latency to 0 in the chaos panel in
both, make a different change in each, and save from both within the same few milliseconds. The
tab that wrote second wins; the other gets a conflict it can act on, but its version 6 is gone
from the history. It is a microsecond window, so driving both saves from a shared timer is the
reliable way to hit it.

**Impact.** A save that a person watched succeed can be absent from the history afterwards. Only
the losing tab finds out, and only because of the read back.

**The fix.** A backend, where the write is a conditional update the server decides on: `PUT` with
`If-Match: <version>` returning 409. The store interface was written for exactly this, six async
methods with an `AbortSignal` and a failure vocabulary that already has the right shapes, so it
is one file. Failing that, `navigator.locks` would serialise saves between same-origin tabs in
every browser that supports it, which is all current ones.

**Why it is not fixed here.** The brief's data layer is in memory and the persistence layer is
localStorage by design, and a web lock would close the window between tabs while still leaving it
open between browsers, which is the case a backend exists to handle. Turning a silent loss into a
visible conflict was the part worth doing without one.

---

## 2. A filter value containing a comma is split into two values, silently

**What it is.** Multi-select values are comma separated in the URL. `splitList()` in
`src/dashboard/_lib/filter-params.ts:37` splits on every comma and trims each part. The comment
directly above it says "a value containing a comma is rejected, not split", which is what the
code should do and does not: only a `,,` sequence is caught.

**How to reproduce.** Any dataset whose values contain commas, which is ordinary for organisation
names. With a payer called `Smith, Jones & Co`, select it, and the URL carries
`f_payer=Smith%2C+Jones+%26+Co`. Reload: the filter is now two values, `Smith` and `Jones & Co`,
neither of which exists. The parser round trip is directly assertable:

```ts
buildFilterParsers(filters).lists.f_payer.parse('Smith, Jones & Co') // ['Smith', 'Jones & Co']
```

**Impact.** A shared link silently becomes a different query. The control then marks both
fragments "not present in current data" and the widgets go honestly empty, so the symptom is
visible but its cause is not: the reader sees a filter they did not set.

**Why it is latent.** No value in the shipped world contains a comma, and the options come from
live data rather than from the configuration, so nothing in the demo triggers it.

**The fix.** Percent encode the separator when serialising and decode on parse, or repeat the key
(`?f_payer=a&f_payer=b`) with `parseAsNativeArrayOf`, which removes the separator problem
entirely. Either way the comment stops being a lie.

**Why it is not fixed here.** Both options change the shape of every shared link, which is the
one piece of state people are told they can paste to each other, and the safer of the two,
repeated keys, needs the nuqs adapter's multi value behaviour verified against the router rather
than assumed. That is not a change to make in the last hour before a review.

---

## 3. Filter ids are unique, but the URL parameter names derived from them are not

**What it is.** `paramNamesFor()` derives `f_<id>` for most filters and `f_<id>_from` and
`f_<id>_to` for a date range. Uniqueness is enforced on filter ids in `load-config.ts`, not on
the names derived from them, so a date range with `id: "submitted"` and a search with
`id: "submitted_from"` both map to `f_submitted_from`.

**How to reproduce.** A configuration with those two filters. Both controls then read the same
parameter, and in `buildFilterParsers` the later one overwrites the earlier in the parser record.
Typing in the search box moves the date range's "from" to the same text, which `readRange` hands
to the data layer as a date; `Date.parse("CLM-1T00:00:00.000Z")` is `NaN`, every comparison is
false, and every row is excluded.

**Impact.** One control drives another, and the intermediate state excludes every row while
showing "No data" rather than an error. The invalid parameter is then cleaned out of the URL on
the next tick, so the state is transient and confusing rather than persistent and diagnosable.

**Why it is latent.** It needs a configuration whose filter ids collide after the suffix is
applied, which no shipped dashboard has and nobody would write by accident.

**The fix.** Validate the derived names rather than the ids: build the parameter list during
`toFilters()` and drop a filter whose parameter name is already taken, with the same notice in the
bar that any other dropped filter gets. That reuses the mechanism that already exists.

**Why it is not fixed here.** The fix belongs in the loader's filter pass, where dropping a filter
is already a first class outcome, and doing it properly means the `IgnoredParam` and
`DroppedFilter` paths both need to carry it. It is a contained change, but it touches the code
path every filter goes through, and it is not worth destabilising that on the day of review for a
case that requires a deliberately adversarial configuration.

---

## 4. The table holds every cell it shows, and the caps are the only thing keeping that small

**What it is.** `TableWidget` renders every row of the current page and every configured column as
real DOM nodes. Nothing is windowed. What keeps that cheap today is three caps rather than the
component: `TABLE_FETCH_LIMIT` is 200 rows, `MAX_PAGE_SIZE` is 100, and `MAX_TABLE_COLUMNS` is 20.
The caps are the reason the earlier decision was to leave it alone, and that decision is recorded
in `DESIGN.md` under **Known limits**.

They are configuration limits, not truths about the data. A configuration is allowed to ask for
the largest of each, and a dashboard is allowed fifty widgets.

**How to reproduce.** A configuration with several table widgets at `pageSize: 100` over twenty
columns. Each one is 2,000 cells, so six of them is 12,000, and the widget cap allows fifty. Sort
a column, or change a filter, and every one of those cells is reconciled again. There is no
hostile file for this yet: `fifty-one-widgets.json` tests the widget cap, not the cell count, and
the widest shipped table has five columns.

**Impact.** Not wrong, slow. Sorting and filtering on a wide, full page table stutters, and a
dashboard of them takes a visible pause on every filter change, which on a dashboard that is
meant to be read while the world changes underneath it is the wrong kind of quiet failure: the
numbers are right and the page feels broken.

**The fix.** Virtualise rows, and columns with them, since twenty columns wide is the case that
actually hurts. A windowed body over a fixed row height is the small version. It needs a scroll
container inside a tile that already scrolls, a measured header, and keyboard and screen reader
behaviour that does not regress: a virtualised table that a keyboard cannot walk through would
trade a performance problem for an accessibility one, and that is not a trade this project makes.

**Why it is not fixed here.** It is a dependency and a rewrite of the one component that is
currently plain and correct, for a configuration nobody has written yet. The caps hold the
present case, and the honest order is to measure it first: build the wide table hostile file,
count the frames on a filter change, then virtualise against that number rather than against a
worry. Raising `MAX_TABLE_COLUMNS` or `MAX_PAGE_SIZE` before that work is done is what would turn
this from a limit into a defect.
