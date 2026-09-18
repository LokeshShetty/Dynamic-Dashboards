import { Component, type ErrorInfo, type ReactNode } from 'react'

import { AlertOctagon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { log } from '@/lib/log'

type Props = {
  widgetId: string
  onRetry: () => void
  children: ReactNode
}

type State = { error: Error | null }

/**
 * The last line of the promise. If a widget body throws for a reason nothing predicted, the
 * dashboard around it survives and the tile says what happened rather than taking the page
 * down or, worse, rendering half of itself.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    log.error('widget.render.crashed', {
      widgetId: this.props.widgetId,
      message: error.message,
      componentStack: info.componentStack,
    })
  }

  private readonly handleRetry = () => {
    this.setState({ error: null })
    this.props.onRetry()
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="border-danger bg-danger-surface flex flex-col items-start gap-2 rounded-md border p-3">
        <p className="text-fg flex items-center gap-2 text-sm font-medium">
          <AlertOctagon aria-hidden="true" className="text-danger size-4" />
          Widget crashed: {error.message}
        </p>
        <Button size="sm" onClick={this.handleRetry}>
          Retry
        </Button>
      </div>
    )
  }
}
