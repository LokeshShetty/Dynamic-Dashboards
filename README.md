# Configurable Dashboard

A dashboard layer that turns a user-authored, versioned JSON configuration into a live dashboard,
built around one promise:

> Every widget is either showing the truth or visibly showing that it cannot.

The interesting part is not the happy path. It is what happens when the configuration is old,
malformed or hostile, when fields are renamed or change type under the renderer, when the data
layer is slow or failing, and when two tabs edit the same dashboard at once.

See [DESIGN.md](DESIGN.md) for the configuration format, the guarantees and the trade-offs, and
[hostile-configs/](hostile-configs/README.md) for the configurations written to break it, each one
run by the test suite.

## Getting started

```sh
npm install
npm run dev
```

Open the app and it redirects to `/d/demo`.

## Scripts

| Script                 | What it does                                          |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Vite dev server                                       |
| `npm run typecheck`    | `tsc -b`, TypeScript in strict mode                   |
| `npm run lint`         | oxlint                                                |
| `npm run format:check` | Prettier in check mode                                |
| `npm run test`         | Vitest run, jsdom, React Testing Library              |
| `npm run build`        | Production build                                      |
| `npm run check`        | All of the above in that order, green before a commit |

## Stack

Vite, React 19, TypeScript strict, Tailwind v4 with cva and `cn`, TanStack Query, React Router,
nuqs for URL state, React Hook Form with zod, Recharts, Zustand, Vitest with React Testing Library.
