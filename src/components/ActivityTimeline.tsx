import { useEffect, useState } from 'react'
import { listActivities } from '@/lib/activities'
import { formatDateTime } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonBlock } from '@/components/Skeleton'
import type { ActivityRow } from '@/types/crm'

const TYPE_LABEL: Record<ActivityRow['type'], string> = {
  call: 'Call',
  email: 'Email',
  meeting: 'Meeting',
  site_visit: 'Site visit',
  quote_sent: 'Quote sent',
  note: 'Note',
  task: 'Task',
}

interface ActivityTimelineProps {
  organisationId?: string
  contactId?: string
  dealId?: string
}

export function ActivityTimeline({ organisationId, contactId, dealId }: ActivityTimelineProps) {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)

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

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <EmptyState title="No activity yet" />
  }

  return (
    <div>
      <ul className="space-y-3">
        {rows.map((activity) => (
          <li key={activity.id} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{activity.subject || TYPE_LABEL[activity.type]}</span>
              <span className="tabular shrink-0 text-xs" style={{ color: 'var(--text-subtle)' }}>
                {formatDateTime(activity.occurred_at)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>{TYPE_LABEL[activity.type]}</span>
              {activity.notes && <span className="truncate">{activity.notes}</span>}
            </div>
          </li>
        ))}
      </ul>

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
    </div>
  )
}
