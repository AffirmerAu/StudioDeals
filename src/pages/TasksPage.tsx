import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '@/lib/toast-context'
import {
  ACTIVITY_TYPE_LABEL,
  isOverdue,
  listTasks,
  setActivityCompleted,
  TASK_FILTERS,
  TASK_FILTER_LABEL,
  type OpenFollowUpRow,
  type TaskFilter,
} from '@/lib/activities'
import { formatDateTime } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonBlock } from '@/components/Skeleton'

const BACK_TO_TASKS = { to: '/tasks', label: 'Tasks' }

const EMPTY_MESSAGE: Record<TaskFilter, { title: string; hint?: string }> = {
  open: { title: 'Nothing outstanding', hint: 'Tasks you set on a deal turn up here.' },
  overdue: { title: 'Nothing overdue' },
  today: { title: 'Nothing due today' },
  week: { title: 'Nothing due this week' },
  done: { title: 'Nothing completed yet' },
}

export function TasksPage() {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<TaskFilter>('open')
  const [rows, setRows] = useState<OpenFollowUpRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listTasks(filter)
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setTotal(result.total)
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
  }, [filter])

  const toggle = async (row: OpenFollowUpRow) => {
    const completing = row.completed_at === null
    const previous = rows
    setBusyId(row.id)
    // The row no longer belongs in this list either way — completing it leaves
    // an open filter, reopening it leaves the done one.
    setRows((current) => current.filter((r) => r.id !== row.id))
    setTotal((current) => Math.max(0, current - 1))
    try {
      await setActivityCompleted(row.id, completing, row.type)
    } catch (error) {
      setRows(previous)
      setTotal((current) => current + 1)
      showToast(error instanceof Error ? error.message : 'Failed to update the task', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          {!loading && (
            <span className="tabular text-sm" style={{ color: 'var(--text-muted)' }}>
              {total} {total === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5">
          {TASK_FILTERS.map((option) => {
            const active = option === filter
            return (
              <button
                key={option}
                type="button"
                onClick={() => setFilter(option)}
                aria-pressed={active}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                style={{
                  borderColor: active ? 'var(--color-brand-500)' : 'var(--border)',
                  color: active ? 'var(--color-brand-500)' : 'var(--text-muted)',
                  background: active ? 'var(--surface-hover)' : 'var(--surface-raised)',
                }}
              >
                {TASK_FILTER_LABEL[option]}
              </button>
            )
          })}
        </div>

        {loading && (
          <div className="mt-5 space-y-2">
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="mt-5">
            <EmptyState {...EMPTY_MESSAGE[filter]} />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <ul className="mt-5 space-y-2">
            {rows.map((row) => {
              const done = row.completed_at !== null
              const overdue = !done && isOverdue(row.due_at)
              const label = row.subject || ACTIVITY_TYPE_LABEL[row.type]
              return (
                <li
                  key={row.id}
                  className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5"
                  style={{
                    borderColor: overdue ? 'var(--color-stage-lost)' : 'var(--border)',
                    background: 'var(--surface-raised)',
                  }}
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={busyId === row.id}
                      onChange={() => void toggle(row)}
                      aria-label={`Mark "${label}" ${done ? 'not done' : 'done'}`}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <p
                        className="text-sm font-medium break-words"
                        style={done ? { textDecoration: 'line-through', color: 'var(--text-muted)' } : undefined}
                      >
                        {label}
                      </p>
                      <p
                        className="tabular text-xs"
                        style={{ color: overdue ? 'var(--color-stage-lost)' : 'var(--text-subtle)' }}
                      >
                        {overdue && 'Overdue · '}
                        {done ? `Done ${formatDateTime(row.completed_at)}` : formatDateTime(row.due_at)}
                        {row.type !== 'task' && ` · from a ${ACTIVITY_TYPE_LABEL[row.type].toLowerCase()}`}
                      </p>
                      {row.notes && (
                        <p className="mt-1 text-xs break-words" style={{ color: 'var(--text-muted)' }}>
                          {row.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* What it hangs off. A task always belongs to something —
                      landing here without a way back to it is a dead end. */}
                  <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs">
                    {row.deal_id && row.deal_title && (
                      <Link
                        to={`/deals/${row.deal_id}`}
                        state={{ from: BACK_TO_TASKS }}
                        className="max-w-48 truncate"
                        style={{ color: 'var(--color-brand-500)' }}
                      >
                        {row.deal_title}
                      </Link>
                    )}
                    {row.contact_id && row.contact_name && (
                      <Link
                        to={`/contacts/${row.contact_id}`}
                        state={{ from: BACK_TO_TASKS }}
                        className="max-w-48 truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {row.contact_name}
                      </Link>
                    )}
                    {!row.deal_id && row.organisation_id && row.organisation_name && (
                      <Link
                        to={`/organisations/${row.organisation_id}`}
                        state={{ from: BACK_TO_TASKS }}
                        className="max-w-48 truncate"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {row.organisation_name}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!loading && total > rows.length && (
          <p className="mt-4 text-xs" style={{ color: 'var(--text-subtle)' }}>
            Showing the first {rows.length} of {total}. Narrow the filter to see the rest.
          </p>
        )}
      </div>
    </div>
  )
}
