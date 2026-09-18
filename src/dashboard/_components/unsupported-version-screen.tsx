import { Lock } from 'lucide-react'

type Props = {
  found: number
  supported: number
  rawText: string
}

/**
 * A configuration from a newer build is not guessed at. It opens read only, says exactly how
 * far ahead it is, and shows itself, so the work is recoverable rather than unopenable.
 */
export function UnsupportedVersionScreen({ found, supported, rawText }: Props) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-8">
      <div
        role="alert"
        className="border-warning bg-warning-surface flex flex-col gap-2 rounded-md border p-4"
      >
        <h1 className="text-fg flex items-center gap-2 text-lg font-semibold">
          <Lock aria-hidden="true" className="size-5" />
          Read only: this dashboard was saved by a newer version
        </h1>
        <p className="text-fg-muted text-sm">
          It is written in configuration format {found}, and this build understands format{' '}
          {supported}. Rendering it anyway would mean guessing at what the newer format means, so
          nothing is rendered and nothing is saved over it.
        </p>
      </div>

      <details open>
        <summary className="text-fg-muted cursor-pointer text-sm">
          The configuration as it was saved
        </summary>
        <pre className="border-border bg-surface-muted text-fg-muted mt-2 max-h-96 overflow-auto rounded-md border p-3 text-xs">
          {rawText}
        </pre>
      </details>
    </div>
  )
}
