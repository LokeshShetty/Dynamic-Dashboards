import type { ReactNode } from 'react'

import type { WidgetLayout } from '../../_lib/config.schema'

type Props = {
  /** A widget with no usable layout is placed by the grid rather than dropped. */
  layout: WidgetLayout | null
  children: ReactNode
}

export function WidgetGridItem({ layout, children }: Props) {
  const style = layout
    ? {
        gridColumnStart: layout.x + 1,
        gridColumnEnd: `span ${layout.w}`,
        gridRowStart: layout.y + 1,
        gridRowEnd: `span ${layout.h}`,
      }
    : { gridColumnEnd: 'span 4' }

  return (
    <div className="flex min-h-0 min-w-0" style={style}>
      {children}
    </div>
  )
}
