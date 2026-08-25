import { useEffect, useState } from 'react'
import {
  ACTIVITY_TYPE_LABEL,
  deleteActivity,
  listActivities,
  setActivityCompleted,
  type TimelineActivityRow,
} from '@/lib/activities'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/lib/toast-context'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonBlock } from '@/components/Skeleton'
import { ActivityFormModal, type ActivityDefaults } from '@/components/ActivityFormModal'
import { ConfirmDialog } from '@/components/ConfirmDialog'

interface ActivityTimelineProps {
  organisationId?: string
  contactId?: string
  dealId?: string
  /** FKs to stamp on anything logged from here. Omit to hide the log button. */
  logDefaults?: ActivityDefaults
}

export function ActivityTimeline({ organisationId, contactId, dealId, logDefaults }: ActivityTimelineProps) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<TimelineActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [editing, setEditing] = useState<TimelineActivityRow | null>(null)
  const [deleting, setDeleting] = useState<TimelineActivityRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
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
  const toggleCompleted = async (activity: TimelineActivityRow) => {
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

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteBusy(true)
    try {
      await deleteActivity(deleting.id)
      setRows((current) => current.filter((r) => r.id !== deleting.id))
      showToast('Activity deleted')
      setDeleting(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete activity', 'error')
    } finally {
      setDeleteBusy(false)
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
      open={logOpen || editing !== null}
      defaults={logDefaults}
      activity={editing}
      onClose={() => {
        setLogOpen(false)
        setEditing(null)
      }}
      onSaved={(saved) =>
        setRows((current) =>
          current.some((r) => r.id === saved.id)
            ? current.map((r) => (r.id === saved.id ? saved : r))
            : [saved, ...current],
        )
      }
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
              onEdit={() => setEditing(activity)}
              onDelete={() => setDeleting(activity)}
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

      <ConfirmDialog
        open={deleting !== null}
        title="Delete activity"
        message={
          deleting
            ? `Delete "${deleting.subject || ACTIVITY_TYPE_LABEL[deleting.type]}"? This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  )
}

function RowAction({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-1 text-xs font-medium transition-colors duration-150"
      style={{ color: color ?? 'var(--text-subtle)' }}
    >
      {label}
    </button>
  )
}

function ActivityItem({
  activity,
  busy,
  onToggleCompleted,
  onEdit,
  onDelete,
}: {
  activity: TimelineActivityRow
  busy: boolean
  onToggleCompleted: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const done = activity.completed_at !== null
  const overdue = activity.due_at !== null && !done && new Date(activity.due_at) < new Date()

  return (
    <li className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{activity.subject || ACTIVITY_TYPE_LABEL[activity.type]}</span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="tabular text-xs" style={{ color: 'var(--text-subtle)' }}>
            {formatDateTime(activity.occurred_at)}
          </span>
          <RowAction label="Edit" onClick={onEdit} />
          <RowAction label="Delete" onClick={onDelete} color="var(--color-stage-lost)" />
        </div>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>{ACTIVITY_TYPE_LABEL[activity.type] ?? activity.type}</span>
        {activity.contact_name && <span className="shrink-0">· {activity.contact_name}</span>}
        {activity.notes && <span className="truncate">{activity.notes}</span>}
      </div>

      {activity.due_at && (
        <label className="mt-2 flex w-fit items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
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
