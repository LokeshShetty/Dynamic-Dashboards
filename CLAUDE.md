# CLAUDE.md

Custom dashboard. Vite + React 18 + TypeScript strict, client only, no backend.

## Stack

- Vite, React 18, TS strict, npm.
- Tailwind with cva + cn, shadcn recipes copied into src/components/ui/, lucide-react for icons, zod for validation, Zustand for client state, Vitest + React Testing Library for tests.
- No second component library, no second state library, no HTTP client. If something feels missing, ask first.

## Folder structure

- Feature folders live under src/ and are named by domain.
- App-wide shared code lives in src/components/, src/hooks/, src/lib/, src/constants/, src/types/, src/styles/.
- Inside a feature: \_components/, \_hooks/, \_lib/, \_constants.ts, \_types.ts. Create only what is actually needed.
- Co-locate by default. Extract only when a second caller exists, never for a hypothetical one.
- A component becomes a folder when it has sub-components, a non-trivial Props type, its own hooks/constants/css, or is nearing 200 lines.
- A component folder gets an index.ts that exports explicit names. Never export \*.
- 500 lines max per file.
- One component per file. One hook per file. One concern per lib file (format.ts, aggregate.ts).
- No utils.ts grab bag. src/lib/utils.ts holds cn only because shadcn expects it there.
- Tests sit next to what they test: parse.test.ts beside parse.ts.

## Where things go

- Pure functions: \_lib/<concern>.ts inside the feature, src/lib/<concern>.ts if app-wide.
- Pure means no React imports. If it touches hooks or JSX it is a hook or a component, not a util.
- Hooks: \_hooks/use-<name>.ts in the feature, src/hooks/ if app-wide. use-widget-data.ts exports useWidgetData.
- Data constants (options arrays, copy strings, limits, status lists) are never inlined in a .tsx. They live in \_constants.ts next door, SCREAMING_SNAKE, as const.
- cva variant configs are the one exception and stay with the component.
- Types: a leaf component gets type Props = {...} inline above it.
- A folder component, or anything shared inside the feature, puts its types in \_types.ts.
- App-wide domain types go in src/types/<domain>.ts. No <name>.types.ts sidecar files.
- zod schemas: \_lib/<name>.schema.ts. The schema is the single source of truth for parsing and for forms.
- Zustand slices: src/lib/store/slices/<name>.slice.ts.
- Design tokens: src/styles/tokens.css.

## Naming and exports

- Files kebab-case. Components PascalCase. Functions and hooks camelCase. Constants SCREAMING_SNAKE.
- Named exports only. No export default for components.
- Import order with a blank line between groups: react, external packages, @/, relative, styles.
- One alias only: @/ maps to src/.

## Code I can still read in six months

- Names carry the story. Default is no comments.
- When a comment is needed it explains why, not what, in one or two lines.
- TODOs look like // TODO(lokesh): reason, issue #n.
- No magic numbers or strings in JSX. If a value means something, name it.
- Repeating UI is data-driven: two or more sibling nodes with the same shape become an array in \_constants.ts plus .map().
- Never copy-paste sibling JSX.
- Early returns over nested conditionals.
- No nested ternaries in JSX. Use a small function or a lookup object.
- any is banned. Use unknown at boundaries, narrowed with zod or a type guard. No casts beyond as const.
- type over interface. as const + (typeof X)[number] instead of enum.
- Every state machine is a discriminated union with a kind field and an exhaustive switch, with never in the default branch.
- Group dependent props into one object (pagination={{ pageSize, onChange }} or pagination={false}).
- Independent props like className and onClick stay flat.
- Every visual component accepts className and merges it with cn.
- A component that takes children declares children explicitly. forwardRef only when actually needed.
- Memoize only with a reason: useMemo for expensive or referentially-compared values, useCallback for handlers going into memoized children or dep arrays, React.memo only after profiling.
- Errors are never swallowed silently.
- No console.\* in committed code. Use a small src/lib/log.ts with log.info/warn/error and dot-named events like config.parse.failed.
- Functions return results ({ ok: true, data } | { ok: false, error }) instead of throwing across a boundary.

## Component contracts

- Every data-displaying surface goes through one shared wrapper that owns loading, empty, error and data states.
- Never a bare spinner, never plain "no data" text, never an error that is not visible and labelled.
- Every button that triggers async work shows a loading state, disables itself while pending, keeps its label, and reports success or failure with a toast.
- Destructive actions go through a confirm dialog first.
- View state (filters, selected item, active tab, mode) lives in the URL, not in component state.

## Styling and accessibility

- Tailwind for layout and spacing, cva for variants, cn for every className merge.
- Colors only through semantic CSS-variable tokens (bg-surface, text-fg-muted, text-danger).
- Palette classes like text-red-500, hex values and text-white are banned.
- No arbitrary values like p-[13px]. style={{}} only for runtime-dynamic values.
- Icons from lucide-react only. No inline <svg>.
- Every interactive element has an accessible name. Keyboard parity everywhere.
- Color never carries meaning alone, always icon + text. Error states get role="alert".
- dangerouslySetInnerHTML is banned.

## Testing

- Vitest + RTL + jsdom.
- Test what has branching: pure functions, parsers, state mapping, hooks via renderHook.
- Test names describe the behaviour. No large snapshot tests.

## Quality gates

- Scripts: typecheck (tsc -b), lint (eslint with no-console, import/order, react-hooks, react/no-danger), format:check (prettier), test (vitest run), build (vite build).
- check runs all of them in that order. npm run check is green before every commit.

## Git

- Conventional commits: type(scope): imperative summary, 72 chars max.
- The body says what was wrong and why this fix is right, not what changed.
- One logical change per commit.
- PR description has Summary, Test plan with exact commands and flows, and Out of scope.
- No em-dashes anywhere: docs, comments, commit messages.
