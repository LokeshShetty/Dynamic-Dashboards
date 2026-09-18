import { useMutation } from '@tanstack/react-query'
import { FilePlus2, SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'

import { dashboardStore } from '../_lib/dashboard-store'
import { describeStorageFailure, toStorageFailure } from '../_lib/storage-error'

type Props = {
  id: string
  onCreated: (id: string) => void
}

/** An unknown id is a dead end unless there is a way forward, so this offers the way forward. */
export function DashboardNotFound({ id, onCreated }: Props) {
  const pushToast = useAppStore((state) => state.pushToast)

  const create = useMutation({
    mutationFn: () => {
      const newId = `dashboard-${Date.now().toString(36)}`
      return dashboardStore.create({ id: newId, title: 'Untitled dashboard' })
    },
    onSuccess: (record) => {
      pushToast({ tone: 'success', title: `Created ${record.id}` })
      onCreated(record.id)
    },
    onError: (error) => {
      pushToast({
        tone: 'error',
        title: 'Could not create the dashboard',
        description: describeStorageFailure(toStorageFailure(error)),
      })
    },
  })

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 p-8">
      <h1 className="text-fg flex items-center gap-2 text-xl font-semibold">
        <SearchX aria-hidden="true" className="text-fg-muted size-5" />
        No dashboard with id “{id}”
      </h1>

      <p className="text-fg-muted text-sm">
        Nothing is saved under that id in this browser. It may have been created in another browser,
        or removed. You can start a new one here.
      </p>

      <Button variant="solid" onClick={() => create.mutate()} disabled={create.isPending}>
        <FilePlus2 aria-hidden="true" className="size-4" />
        {create.isPending ? 'Creating…' : 'Create a new dashboard'}
      </Button>
    </div>
  )
}
