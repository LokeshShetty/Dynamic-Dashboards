/* oxlint-disable react/no-array-index-key -- these lists are rebuilt from immutable
   render input on every pass and are never reordered, so the index is the stable identity. */
import { useMemo, useState } from 'react'

import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Unlink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { ResolvedSort } from '@/data/_types'
import { cn } from '@/lib/utils'
import type { DataRow, DataValue } from '@/types/data'

import type { ColumnView } from '../../_lib/table-columns'

type Props = {
  columns: ColumnView[]
  rows: DataRow[]
  matchedRows: number
  sort: ResolvedSort | null
  pageSize: number
}

type SortState = { field: string; direction: 'asc' | 'desc' }

/** Sorting and paging happen here, over the rows already fetched, so neither costs a request. */
export function DataTable({ columns, rows, matchedRows, sort, pageSize }: Props) {
  const [sortState, setSortState] = useState<SortState | null>(
    sort?.kind === 'applied' ? { field: sort.field, direction: sort.direction } : null,
  )
  const [page, setPage] = useState(0)

  const sorted = useMemo(() => sortRows(rows, sortState), [rows, sortState])
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount - 1)
  const visible = sorted.slice(currentPage * pageSize, currentPage * pageSize + pageSize)

  const toggleSort = (field: string) => {
    setPage(0)
    setSortState((current) =>
      current?.field === field
        ? { field, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { field, direction: 'asc' },
    )
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {sort?.kind === 'unresolved' ? (
        <p role="alert" className="text-fg-muted text-xs">
          The configured sort field <code className="text-fg">{sort.field}</code> is not in the
          dataset any more, so these rows are in their natural order.
        </p>
      ) : null}

      <div className="min-h-0 overflow-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-border border-b">
              {columns.map((column) => (
                <th
                  key={column.name}
                  scope="col"
                  aria-sort={ariaSort(column, sortState)}
                  className={cn(
                    'text-fg-muted p-2 align-bottom font-medium',
                    column.kind === 'ok' && column.align === 'right' ? 'text-right' : 'text-left',
                  )}
                >
                  {column.kind === 'ok' ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(column.name)}
                      className="hover:text-fg inline-flex items-center gap-1"
                    >
                      {column.label}
                      <SortIcon column={column} sortState={sortState} />
                    </button>
                  ) : (
                    <span
                      className="text-danger inline-flex items-center gap-1"
                      title={column.reason}
                    >
                      <Unlink aria-hidden="true" className="size-3" />
                      {column.label}
                    </span>
                  )}
                  <span className="text-fg-subtle block text-[10px] font-normal">
                    {column.kind === 'ok' ? column.typeLabel : 'unresolvable'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-border/60 border-b last:border-0">
                {columns.map((column) => (
                  <td
                    key={column.name}
                    className={cn(
                      'text-fg p-2 whitespace-nowrap',
                      column.kind === 'ok' && column.align === 'right'
                        ? 'text-right tabular-nums'
                        : 'text-left',
                    )}
                  >
                    {column.kind === 'ok' ? (
                      column.format(row[column.name] ?? null)
                    ) : (
                      <span className="text-fg-subtle" title={column.reason}>
                        —<span className="sr-only">unresolvable column</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-fg-muted flex items-center justify-between gap-2 text-xs">
        <span>
          {matchedRows > rows.length
            ? `Showing the first ${rows.length} of ${matchedRows.toLocaleString()} matching rows`
            : `${matchedRows.toLocaleString()} matching rows`}
        </span>
        <span className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            aria-label="Previous page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span>
            Page {currentPage + 1} of {pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            aria-label="Next page"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </span>
      </div>
    </div>
  )
}

function ariaSort(column: ColumnView, sortState: SortState | null) {
  if (column.kind !== 'ok' || sortState?.field !== column.name) return 'none'
  return sortState.direction === 'asc' ? 'ascending' : 'descending'
}

function SortIcon({ column, sortState }: { column: ColumnView; sortState: SortState | null }) {
  if (column.kind !== 'ok' || sortState?.field !== column.name) return null
  const Icon = sortState.direction === 'asc' ? ArrowUp : ArrowDown
  return <Icon aria-hidden="true" className="size-3" />
}

function sortRows(rows: ReadonlyArray<DataRow>, sortState: SortState | null): DataRow[] {
  if (!sortState) return [...rows]

  const direction = sortState.direction === 'asc' ? 1 : -1

  return [...rows].sort(
    (left, right) =>
      compare(left[sortState.field] ?? null, right[sortState.field] ?? null) * direction,
  )
}

function compare(left: DataValue, right: DataValue): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  if (typeof left === 'number' && typeof right === 'number') return left - right
  return String(left).localeCompare(String(right))
}
