# Hostile configurations

Configurations designed to break the renderer. Every one of them is run by
`src/hostile-configs.test.ts`, which reads this folder directly, checks each file against
`manifest.json`, and asserts that nothing throws and that `Object.prototype` is untouched
afterwards. The app reads the same files: open any dashboard and pick one from the chaos
panel to see it rendered, read only, with a banner saying it is a hostile file.

`manifest.json` is the source of truth. This list is written from it, one line per file.

**`v1-legacy.json` is the only file expected to open completely fine.** It is written in the
oldest supported format and migrates forward on the way in. Everything else is expected to
fail in a specific, visible way.

| File                                | What it attacks                                                     | Expected outcome                                 |
| ----------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------ |
| `not-json.txt`                      | text that is not JSON at all                                        | dashboard level error (`not-json`)               |
| `root-is-array.json`                | a JSON document whose root is an array                              | dashboard level error (`not-an-object`)          |
| `empty-object.json`                 | an object with nothing in it                                        | dashboard level error (`missing-schema-version`) |
| `missing-schema-version.json`       | a complete looking dashboard with no schemaVersion                  | dashboard level error (`missing-schema-version`) |
| `future-schema-version.json`        | a format from a newer build                                         | read only, unsupported schemaVersion 99          |
| `v1-legacy.json`                    | an old format that must still open                                  | loads (5 valid, migrated from v1)                |
| `unknown-widget-type.json`          | a widget claiming a type that does not exist                        | loads (1 valid, 1 invalid)                       |
| `duplicate-ids.json`                | two widgets claiming the same id                                    | loads (1 valid, 1 duplicate-id)                  |
| `negative-and-infinite-layout.json` | layout numbers that are negative, infinite, fractional and a string | loads (4 invalid)                                |
| `overlapping-layout.json`           | two widgets occupying the same cells                                | loads (1 valid, 1 overlapping-layout)            |
| `five-thousand-widgets.json`        | a document large enough to be expensive to reject                   | dashboard level error (`too-large`)              |
| `fifty-one-widgets.json`            | one widget more than the limit, in a small document                 | dashboard level error (`too-many-widgets`)       |
| `deep-nesting.json`                 | an object nested past the depth limit                               | dashboard level error (`too-deep`)               |
| `huge-string-title.json`            | a single enormous string                                            | dashboard level error (`too-large`)              |
| `title-201-chars.json`              | a title one character past the limit                                | dashboard level error (`invalid-dashboard`)      |
| `xss-title-and-text.json`           | script tags, an onerror image and a javascript: link                | loads (2 valid)                                  |
| `prototype-pollution.json`          | **proto** at the root and constructor.prototype inside a widget     | dashboard level error (`forbidden-key`)          |
| `binding-missing-dataset.json`      | a dashboard bound to a dataset that does not exist                  | loads (2 valid)                                  |
| `binding-missing-field.json`        | a metric bound to a field that does not exist                       | loads (2 valid)                                  |
| `binding-type-mismatch.json`        | a sum over a text field                                             | loads (2 valid)                                  |
| `filter-unknown-kind.json`          | a filter kind that does not exist, beside a valid filter            | loads (1 valid, 1 filter dropped)                |
| `filter-on-missing-field.json`      | a filter naming a field the dataset does not have                   | loads (1 valid)                                  |
| `unicode-rtl-override-title.json`   | right to left overrides and isolates in titles and body text        | loads (2 valid)                                  |

## Running them

```sh
npm run test              # the runner asserts every file against the manifest
npm run dev               # then pick a file from the chaos panel, bottom right
```

Adding a file means adding it to `manifest.json` in the same commit: the runner fails if a
file is missing from the manifest, if the manifest names a file that is not there, or if a
file is missing from this README.
