type Props = {
  configText: string
  className?: string
}

/** Every tile can show the configuration it came from, however badly that configuration ended. */
export function WidgetConfigDisclosure({ configText, className }: Props) {
  return (
    <details className={className}>
      <summary className="text-fg-subtle hover:text-fg-muted cursor-pointer text-xs">
        Show configuration
      </summary>
      <pre className="border-border bg-surface-muted text-fg-muted mt-1 max-h-48 overflow-auto rounded-md border p-2 text-xs">
        {configText}
      </pre>
    </details>
  )
}
