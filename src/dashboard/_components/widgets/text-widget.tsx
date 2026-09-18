/* oxlint-disable react/no-array-index-key -- these lists are rebuilt from immutable
   render input on every pass and are never reordered, so the index is the stable identity. */
import { BidiText } from '@/components/ui/bidi-text'
import { cn } from '@/lib/utils'

import type { TextWidget } from '../../_lib/config.schema'
import { parseMarkdown, type InlineToken } from '../../_lib/markdown'
import { TextSkeleton } from '../skeletons/widget-skeletons'
import { WidgetFrame } from '../widget-frame'

type Props = { widget: TextWidget }

const TONE_CLASS = {
  default: 'text-fg-muted',
  note: 'text-fg-muted border-border border-l-2 pl-3',
  warning: 'text-fg border-warning border-l-2 pl-3',
} as const

/**
 * Text is the one widget whose content comes straight from the configuration, so it is the
 * one place a hostile configuration could try to reach the DOM. It never can: the body is
 * parsed into tokens and rendered as React elements, there is no HTML path, and the grammar
 * has no links or images to carry a URL.
 */
export function TextWidgetTile({ widget }: Props) {
  const blocks = parseMarkdown(widget.body)

  return (
    <WidgetFrame
      title={widget.title}
      widgetId={widget.id}
      state={{ kind: 'ok', result: null, fetchedAt: 0, isRefreshing: false }}
      skeleton={<TextSkeleton />}
      configText={JSON.stringify(widget, null, 2)}
      onRefresh={() => undefined}
    >
      {() => (
        <div className={cn('flex flex-col gap-2 text-sm', TONE_CLASS[widget.tone ?? 'default'])}>
          {blocks.map((block, index) =>
            block.kind === 'paragraph' ? (
              <p key={index}>
                <Inline tokens={block.content} />
              </p>
            ) : (
              <ul key={index} className="list-disc pl-5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Inline tokens={item} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </div>
      )}
    </WidgetFrame>
  )
}

function Inline({ tokens }: { tokens: InlineToken[] }) {
  return (
    <>
      {tokens.map((token, index) => {
        if (token.kind === 'bold') {
          return (
            <strong key={index}>
              <BidiText>{token.value}</BidiText>
            </strong>
          )
        }
        if (token.kind === 'italic') {
          return (
            <em key={index}>
              <BidiText>{token.value}</BidiText>
            </em>
          )
        }
        if (token.kind === 'code') {
          return (
            <code key={index} className="bg-surface-muted text-fg rounded px-1 text-xs">
              <BidiText>{token.value}</BidiText>
            </code>
          )
        }
        return <BidiText key={index}>{token.value}</BidiText>
      })}
    </>
  )
}
