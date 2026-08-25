import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useToast } from '@/lib/toast-context'
import {
  DEALS_PAGE_SIZE,
  deleteDeal,
  listDeals,
  type DealBoardRow,
  type DealSortColumn,
} from '@/lib/deals'
import { formatCents, formatDate } from '@/lib/format'
import { CompanyLogo } from '@/components/CompanyLogo'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonTableRows } from '@/components/Skeleton'
import { Pagination } from '@/components/Pagination'
import { SortableHeader, type SortState } from '@/components/SortableHeader'
import { StageBadge } from '@/components/StageBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DealDetailDrawer } from '@/components/deals/DealDetailDrawer'
import { DealFormModal } from '@/components/deals/DealFormModal'

const DEAL_TYPE_OPTIONS = [
  { value: '', label: 'All deal types' },
  { value: 'production', label: 'Production' },
  { value: 'prestarter', label: 'Prestarter' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: '', label: 'All statuses' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

export function DealsPage() {
  const { showToast } = useToast()
  const { stages, loading: stagesLoading } = usePipelineStages()

  const [rows, setRows] = useState<DealBoardRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [stageId, setStageId] = useState<number | null>(null)
  const [dealType, setDealType] = useState('')
  // Open by default: a deals list is usually about live work, and the closed
  // stages only ever grow.
  const [status, setStatus] = useState('open')
  const [sort, setSort] = useState<SortState<DealSortColumn>>({ column: 'expected_close_date', ascending: true })

  const [viewingDeal, setViewingDeal] = useState<DealBoardRow | null>(null)
  const [editingDeal, setEditingDeal] = useState<DealBoardRow | null>(null)
  const [deletingDeal, setDeletingDeal] = useState<DealBoardRow | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const wonStageIds = stages.filter((s) => s.is_won).map((s) => s.id)
  const lostStageIds = stages.filter((s) => s.is_lost).map((s) => s.id)

  useEffect(() => {
    if (stagesLoading) return
    let cancelled = false
    setLoading(true)
    listDeals({
      search: debouncedSearch,
      stageId,
      dealType,
      status,
      wonStageIds,
      lostStageIds,
      sortColumn: sort.column,
      ascending: sort.ascending,
      page,
    })
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setTotal(result.total)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load deals', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, stageId, dealType, status, sort, page, stagesLoading])

  // Any filter change invalidates the page number — page 4 of the old result
  // set is meaningless against the new one.
  const resetting = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value)
    setPage(0)
  }

  const handleConfirmDelete = async () => {
    if (!deletingDeal) return
    setDeleteBusy(true)
    try {
      await deleteDeal(deletingDeal.id)
      setRows((current) => current.filter((d) => d.id !== deletingDeal.id))
      setTotal((current) => Math.max(0, current - 1))
      setViewingDeal((current) => (current?.id === deletingDeal.id ? null : current))
      showToast('Deal deleted')
      setDeletingDeal(null)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete deal', 'error')
    } finally {
      setDeleteBusy(false)
    }
  }

  const toggleSort = (column: DealSortColumn) => {
    setSort((current) => ({ column, ascending: current.column === column ? !current.ascending : true }))
    setPage(0)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Deals</h1>
        <span className="tabular text-sm" style={{ color: 'var(--text-muted)' }}>
          {total} {total === 1 ? 'deal' : 'deals'}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => resetting(setSearch)(e.target.value)}
          placeholder="Search title, organisation or source…"
          aria-label="Search deals"
          className="w-80 rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        />
        <select
          value={status}
          onChange={(e) => resetting(setStatus)(e.target.value)}
          aria-label="Filter by status"
          className={selectClass}
          style={selectStyle}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={stageId === null ? '' : String(stageId)}
          onChange={(e) => resetting(setStageId)(e.target.value === '' ? null : Number(e.target.value))}
          aria-label="Filter by stage"
          className={selectClass}
          style={selectStyle}
        >
          <option value="">All stages</option>
          {stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
        <select
          value={dealType}
          onChange={(e) => resetting(setDealType)(e.target.value)}
          aria-label="Filter by deal type"
          className={selectClass}
          style={selectStyle}
        >
          {DEAL_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div
        className="mt-5 overflow-x-auto rounded-lg border"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <SortableHeader column="title" label="Deal" sort={sort} onSort={toggleSort} />
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                Organisation
              </th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                Contact
              </th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                Stage
              </th>
              <SortableHeader column="expected_close_date" label="Expected close" sort={sort} onSort={toggleSort} />
              <SortableHeader column="value_cents" label="Value" sort={sort} onSort={toggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {(loading || stagesLoading) && <SkeletonTableRows rows={10} cols={6} />}
            {!loading &&
              !stagesLoading &&
              rows.map((deal) => {
                const stage = stages.find((s) => s.id === deal.stage_id)
                return (
                  <tr
                    key={deal.id}
                    onClick={() => setViewingDeal(deal)}
                    className="cursor-pointer border-b transition-colors duration-150 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3 font-medium">{deal.title}</td>
                    <td className="px-4 py-3">
                      {/* stopPropagation so following the link doesn't also
                          open the drawer behind it. */}
                      <Link
                        to={`/organisations/${deal.organisation_id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2"
                        style={{ color: 'var(--color-brand-500)' }}
                      >
                        <CompanyLogo name={deal.organisation_name} website={deal.organisation_website} size={20} />
                        {deal.organisation_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                      {deal.primary_contact_id && deal.contact_name ? (
                        <Link
                          to={`/contacts/${deal.primary_contact_id}`}
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: 'var(--color-brand-500)' }}
                        >
                          {deal.contact_name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {stage && <StageBadge stageKey={stage.key} label={stage.label} />}
                    </td>
                    <td className="tabular px-4 py-3">{formatDate(deal.expected_close_date)}</td>
                    <td className="tabular px-4 py-3 text-right">{formatCents(deal.value_cents)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>

        {!loading && !stagesLoading && rows.length === 0 && (
          <div className="p-4">
            <EmptyState title="No deals match" hint="Try clearing a filter or widening the search." />
          </div>
        )}
      </div>

      <div className="mt-4">
        <Pagination page={page} pageSize={DEALS_PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      <DealDetailDrawer
        deal={viewingDeal}
        stages={stages}
        onClose={() => setViewingDeal(null)}
        onEdit={setEditingDeal}
        onDelete={setDeletingDeal}
      />

      <DealFormModal
        open={editingDeal !== null}
        deal={editingDeal}
        defaultStageId={editingDeal?.stage_id ?? stages[0]?.id ?? 1}
        // Only consulted when creating, which this page never does.
        computeCreatePosition={() => 1000}
        onClose={() => setEditingDeal(null)}
        onSaved={(saved) => {
          setRows((current) => current.map((d) => (d.id === saved.id ? saved : d)))
          setViewingDeal((current) => (current?.id === saved.id ? saved : current))
          setEditingDeal(null)
        }}
        onSaveFailed={(previous) => {
          setRows((current) => current.map((d) => (d.id === previous.id ? previous : d)))
        }}
      />

      <ConfirmDialog
        open={deletingDeal !== null}
        title="Delete deal"
        message={
          deletingDeal
            ? `Delete "${deletingDeal.title}"? Any activities logged against it are deleted too. This can't be undone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingDeal(null)}
      />
    </div>
  )
}

const selectClass = 'rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150'
const selectStyle = { borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }
