import { useEffect, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonBlock } from '@/components/Skeleton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { TaskFormModal } from '@/components/TaskFormModal'
import { formatDateTime } from '@/lib/format'
import { useToast } from '@/lib/toast-context'
import {
  ACTIVITY_TYPE_LABEL,
  activityTypePhrase,
  deleteActivity,
  isOverdue,
  listOpenTasksFor,
  setActivityCompleted,
  type TaskTarget,
  type TimelineActivityRow,
} from '@/lib/activities'

interface RecordTasksProps {
  target: TaskTarget
  /** Bumped when a task is completed, so the history reloads and shows it. */
  onCompleted: () => void
}

export function RecordTasks({ target, onCompleted }: RecordTasksProps) {
  const { showToast } = useToast()
  const [rows, setRows] = useState<TimelineActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<TimelineActivityRow | null>(null)
  const [deleting, setDeleting] = useState<TimelineActivityRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listOpenTasksFor(target)
      .then((result) => {
        if (!cancelled) setRows(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load tasks', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.kind, target.id])

  const complete = async (row: TimelineActivityRow) => {
    setBusyId(row.id)
    // Optimistic: the row leaves the list, because an open-tasks list is
    // exactly the things not yet done.
    const previous = rows
    setRows((current) => current.filter((r) => r.id !== row.id))
    try {
      await setActivityCompleted(row.id, true, row.type)
      onCompleted()
    } catch (error) {
      setRows(previous)
      showToast(error instanceof Error ? error.message : 'Failed to complete the task', 'error')
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
      showToast('Task deleted')
      setDeleting(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete the task', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const openCount = rows.length
  const overdueCount = rows.filter((row) => isOverdue(row.due_at)).length

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">
          Tasks
          {openCount > 0 && (
            <span className="tabular ml-2 text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>
              {overdueCount > 0 ? (
                <span style={{ color: 'var(--color-stage-lost)' }}>{overdueCount} overdue</span>
              ) : (
                `${openCount} open`
              )}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
          className="rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Add task
        </button>
      </div>

      {loading && <SkeletonBlock className="mt-3 h-16 w-full" />}

      {!loading && rows.length === 0 && (
        <div className="mt-2">
          <EmptyState title="Nothing outstanding" />
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => {
            const overdue = isOverdue(row.due_at)
            const label = row.subject || ACTIVITY_TYPE_LABEL[row.type]
            return (
              <li
                key={row.id}
                className="rounded-lg border px-3 py-2.5"
                style={{
                  borderColor: overdue ? 'var(--color-stage-lost)' : 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={busyId === row.id}
                    onChange={() => void complete(row)}
                    aria-label={`Mark "${label}" done`}
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    {/* Wraps rather than truncates: the panel is narrow and a
                        half-shown reminder is not a reminder. */}
                    <p className="text-sm font-medium break-words">{label}</p>
                    <p
                      className="tabular text-xs"
                      style={{ color: overdue ? 'var(--color-stage-lost)' : 'var(--text-subtle)' }}
                    >
                      {overdue ? 'Overdue · ' : ''}
                      {formatDateTime(row.due_at)}
                      {/* A follow-up hung off a call is outstanding work too,
                          but it is not a task someone raised. */}
                      {row.type !== 'task' && ` · from ${activityTypePhrase(row.type)}`}
                    </p>
                    {row.notes && (
                      <p className="mt-1 text-xs break-words" style={{ color: 'var(--text-muted)' }}>
                        {row.notes}
                      </p>
                    )}

                    <div className="mt-1.5 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(row)
                          setFormOpen(true)
                        }}
                        className="text-xs font-medium transition-colors duration-150"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(row)}
                        className="text-xs font-medium transition-colors duration-150"
                        style={{ color: 'var(--color-stage-lost)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <TaskFormModal
        open={formOpen}
        target={target}
        task={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setRows((current) => {
            const next = current.some((r) => r.id === saved.id)
              ? current.map((r) => (r.id === saved.id ? saved : r))
              : [...current, saved]
            return next.sort((a, b) => (a.due_at ?? '').localeCompare(b.due_at ?? ''))
          })
          setFormOpen(false)
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete task"
        message={
          deleting ? `Delete "${deleting.subject || ACTIVITY_TYPE_LABEL[deleting.type]}"? This can't be undone.` : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </section>
  )
}
