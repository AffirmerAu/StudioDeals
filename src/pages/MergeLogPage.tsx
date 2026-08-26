import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { listMerges, snapshotFields, type MergeLogRow } from '@/lib/merges'
import { formatDateTime } from '@/lib/format'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { BackLink, useBackTarget } from '@/components/RecordPage'

export function MergeLogPage() {
  const { session } = useAuth()
  const { showToast } = useToast()
  const back = useBackTarget({ to: '/organisations', label: 'Organisations' })

  const [rows, setRows] = useState<MergeLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listMerges()
      .then((result) => {
        if (!cancelled) setRows(result)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load the merge log', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-8">
      <div className="max-w-3xl">
        <BackLink target={back} />
        <h1 className="mt-3 text-xl font-semibold tracking-tight">Merge history</h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Every merge, newest first. Merging deletes the duplicate, so the snapshot kept here is the only record of
          what it held — open one to see the fields that didn't carry across.
        </p>

        {loading && (
          <div className="mt-6 space-y-2">
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
            <SkeletonBlock className="h-16 w-full" />
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div className="mt-6">
            <EmptyState title="Nothing merged yet" hint="Merges appear here as soon as you make one." />
          </div>
        )}

        {!loading && rows.length > 0 && (
          <ul className="mt-6 space-y-2">
            {rows.map((row) => {
              const fields = snapshotFields(row.snapshot)
              const isOpen = expanded === row.id
              const survivorHref =
                row.entityType === 'organisation' ? `/organisations/${row.survivorId}` : `/contacts/${row.survivorId}`

              return (
                <li key={row.id} className="rounded-lg border" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{row.mergedName ?? 'Unnamed record'}</span>
                        <span style={{ color: 'var(--text-muted)' }}> merged into </span>
                        {row.survivorName ? (
                          <Link
                            to={survivorHref}
                            state={{ from: { to: '/merges', label: 'Merge history' } }}
                            className="font-medium"
                            style={{ color: 'var(--color-brand-500)' }}
                          >
                            {row.survivorName}
                          </Link>
                        ) : (
                          // The survivor has since been merged away or deleted
                          // itself. Saying so beats a dead link.
                          <span style={{ color: 'var(--text-subtle)' }}>a record that no longer exists</span>
                        )}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: 'var(--text-subtle)' }}>
                        <span className="capitalize">{row.entityType}</span>
                        {' · '}
                        <span className="tabular">{formatDateTime(row.mergedAt)}</span>
                        {row.mergedBy && session?.user.id === row.mergedBy && ' · by you'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : row.id)}
                      aria-expanded={isOpen}
                      className="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors duration-150"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    >
                      {isOpen ? 'Hide' : 'Snapshot'}
                    </button>
                  </div>

                  {isOpen && (
                    <dl
                      className="space-y-1.5 border-t px-3 py-3 text-sm"
                      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                    >
                      {fields.length === 0 && (
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          The snapshot holds nothing beyond the record's identifiers.
                        </p>
                      )}
                      {fields.map((field) => (
                        <div key={field.label} className="flex items-start justify-between gap-3">
                          <dt style={{ color: 'var(--text-subtle)' }}>{field.label}</dt>
                          <dd className="min-w-0 break-words text-right" style={{ color: 'var(--text)' }}>
                            {field.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
