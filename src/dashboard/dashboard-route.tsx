import { useMemo, type ReactNode } from 'react'

import { useMutation } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router'

import { ChaosPanel } from '@/chaos/_components/chaos-panel'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { DashboardNotFound } from '@/storage/_components/dashboard-not-found'
import { RevisionBanner } from '@/storage/_components/revision-banner'
import { useDashboardRecord } from '@/storage/_hooks/use-dashboard-record'
import { useRevision, useRevisionParam } from '@/storage/_hooks/use-revision'
import { useSaveDashboard } from '@/storage/_hooks/use-save-dashboard'

import { DashboardErrorScreen } from './_components/dashboard-error-screen'
import { DashboardSkeleton } from './_components/dashboard-skeleton'
import { DashboardView } from './_components/dashboard-view'
import { loadDashboardConfig } from './_lib/load-config'

/**
 * Everything a saved dashboard can be on the way in: still loading, missing, unreadable, a past
 * revision, or the current one. None of those is a blank page.
 */
export function DashboardRoute() {
  const { id = 'demo' } = useParams()
  const navigate = useNavigate()
  const { state, refetch } = useDashboardRecord(id)
  const { revision, leaveRevision } = useRevisionParam()

  if (state.kind === 'loading') {
    return (
      <Shell>
        <DashboardSkeleton />
      </Shell>
    )
  }

  if (state.kind === 'not-found') {
    return (
      <Shell>
        <DashboardNotFound id={id} onCreated={(newId) => void navigate(`/d/${newId}`)} />
      </Shell>
    )
  }

  if (state.kind === 'corrupt') {
    return (
      <Shell>
        <DashboardErrorScreen
          heading="The stored dashboard is corrupt"
          message={`Stored config is corrupt: ${state.reason}. Nothing has been thrown away: you can reset this browser's dashboards to the shipped ones from the chaos panel, or open a revision with ?rev=N.`}
          action={<Button onClick={() => void refetch()}>Try reading it again</Button>}
        />
      </Shell>
    )
  }

  if (state.kind === 'error') {
    return (
      <Shell>
        <DashboardErrorScreen
          heading="This dashboard could not be read"
          message={state.reason}
          action={<Button onClick={() => void refetch()}>Try again</Button>}
        />
      </Shell>
    )
  }

  return (
    <Shell>
      {revision === null ? (
        <CurrentDashboard record={state.record} />
      ) : (
        <RevisionDashboard
          dashboardId={id}
          version={revision}
          currentVersion={state.record.version}
          onLeave={leaveRevision}
        />
      )}
    </Shell>
  )
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-dvh">
      {children}
      <ChaosPanel />
    </main>
  )
}

function CurrentDashboard({
  record,
}: {
  record: { id: string; version: number; savedAt: string; config: string; revisionCount: number }
}) {
  const load = useMemo(() => loadDashboardConfig(record.config), [record.config])

  return (
    <DashboardView
      load={load}
      saved={{
        version: record.version,
        savedAt: record.savedAt,
        config: record.config,
        revisionCount: record.revisionCount,
      }}
    />
  )
}

/** A revision opens read only. Restoring it is a new save, so the history is only ever added to. */
function RevisionDashboard({
  dashboardId,
  version,
  currentVersion,
  onLeave,
}: {
  dashboardId: string
  version: number
  currentVersion: number
  onLeave: () => void
}) {
  const revisionState = useRevision(dashboardId, version)
  const save = useSaveDashboard(dashboardId)
  const pushToast = useAppStore((store) => store.pushToast)

  const restore = useMutation({
    mutationFn: async (config: string) => {
      const outcome = await save.mutateAsync({
        id: dashboardId,
        config,
        expectedVersion: currentVersion,
      })

      if (outcome.kind === 'conflict') {
        pushToast({
          tone: 'error',
          title: 'Restore refused',
          description: `Someone saved version ${outcome.current.version} while you were looking at this revision. Reload and try again.`,
        })
      }

      return outcome
    },
    onSuccess: (outcome) => {
      if (outcome.kind === 'saved') onLeave()
    },
  })

  if (revisionState.kind === 'loading') return <DashboardSkeleton />

  if (revisionState.kind === 'error') {
    return (
      <DashboardErrorScreen
        heading="That revision could not be opened"
        message={revisionState.reason}
        action={<Button onClick={onLeave}>Back to the current version</Button>}
      />
    )
  }

  const load = loadDashboardConfig(revisionState.revision.config)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <RevisionBanner
        revision={revisionState.revision}
        isRestoring={restore.isPending}
        onRestore={() => restore.mutate(revisionState.revision.config)}
        onLeave={onLeave}
      />

      <div className="pointer-events-none opacity-90">
        <DashboardView
          load={load}
          saved={{
            version: revisionState.revision.version,
            savedAt: revisionState.revision.savedAt,
            config: revisionState.revision.config,
            revisionCount: revisionState.revision.total,
          }}
        />
      </div>
    </div>
  )
}
