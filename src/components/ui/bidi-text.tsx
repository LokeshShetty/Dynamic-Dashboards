import { stripBidiControls } from '@/lib/text'

type Props = {
  children: string
  className?: string
}

/** Text that came from a configuration file, isolated so it cannot rearrange the page. */
export function BidiText({ children, className }: Props) {
  return <bdi className={className}>{stripBidiControls(children)}</bdi>
}
