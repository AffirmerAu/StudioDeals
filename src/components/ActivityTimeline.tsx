import { useEffect, useState } from 'react'
import { ACTIVITY_TYPE_LABEL, listActivities, setActivityCompleted } from '@/lib/activities'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/lib/toast-context'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonBlock } from '@/components/Skeleton'
import { ActivityFormModal, type ActivityDefaults } from '@/components/ActivityFormModal'
import type { ActivityRow } from '@/types/crm'

interface ActivityTimelineProps {
  organisationId?: string
  contactId?: string
  dealId?: string
  /** FKs to stamp on anything logged from here. Omit to hide the log button. */
  logDefaults?: ActivityDefaults
}

export function ActivityTimeline({ organisationId, contactId, dealId, logDefaults }: ActivityTimelineProps) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listActivities({ organisationId, contactId, dealId, offset: 0 })
      .then((page) => {
        if (cancelled) return
        setRows(page.rows)
        setHasMore(page.hasMore)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [organisationId, contactId, dealId])

  const loadMore = () => {
    setLoadingMore(true)
    listActivities({ organisationId, contactId, dealId, offset: rows.length })
      .then((page) => {
        setRows((current) => [...current, ...page.rows])
        setHasMore(page.hasMore)
      })
      .finally(() => setLoadingMore(false))
  }

  // Optimistic: a controlled checkbox that waits for the round-trip before it
  // ticks reads as a dead click. Roll back if the write fails.
  const toggleCompleted = async (activity: ActivityRow) => {
    const completing = activity.completed_at === null
    setBusyId(activity.id)
    setRows((current) =>
      current.map((r) => (r.id === activity.id ? { ...r, completed_at: completing ? new Date().toISOString() : null } : r)),
    )
    try {
      const saved = await setActivityCompleted(activity.id, completing)
      setRows((current) => current.map((r) => (r.id === saved.id ? saved : r)))
    } catch (error) {
      setRows((current) => current.map((r) => (r.id === activity.id ? activity : r)))
      showToast(error instanceof Error ? error.message : 'Failed to update follow-up', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const header = logDefaults && (
    <div className="mb-3 flex justify-end">
      <button
        type="button"
        onClick={() => setLogOpen(true)}
        className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        Log activity
      </button>
    </div>
  )

  const modal = logDefaults && (
    <ActivityFormModal
      open={logOpen}
      defaults={logDefaults}
      onClose={() => setLogOpen(false)}
      onSaved={(saved) => setRows((current) => [saved, ...current])}
    />
  )

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div>
      {header}

      {rows.length === 0 ? (
        <EmptyState title="No activity yet" />
      ) : (
        <ul className="space-y-3">
          {rows.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              busy={busyId === activity.id}
              onToggleCompleted={() => void toggleCompleted(activity)}
            />
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-3 w-full rounded-lg border py-2 text-sm font-medium transition-colors duration-150 disabled:opacity-60"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}

      {modal}
    </div>
  )
}

function ActivityItem({
  activity,
  busy,
  onToggleCompleted,
}: {
  activity: ActivityRow
  busy: boolean
  onToggleCompleted: () => void
}) {
  const done = activity.completed_at !== null
  const overdue = activity.due_at !== null && !done && new Date(activity.due_at) < new Date()

  return (
    <li className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{activity.subject || ACTIVITY_TYPE_LABEL[activity.type]}</span>
        <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-subtle)' }}>
          {formatDateTime(activity.occurred_at)}
        </span>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{ACTIVITY_TYPE_LABEL[activity.type] ?? activity.type}</span>
        {activity.notes && <span className="truncate">{activity.notes}</span>}
      </div>

      {activity.due_at && (
        <label className="mt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={done} disabled={busy} onChange={onToggleCompleted} />
          <span
            className="tabular"
            style={{
              color: overdue ? 'var(--color-stage-lost)' : undefined,
              textDecoration: done ? 'line-through' : undefined,
            }}
          >
            {done ? 'Done' : overdue ? 'Overdue' : 'Due'} {formatDateTime(activity.due_at)}
          </span>
        </label>
      )}
    </li>
  )
}
