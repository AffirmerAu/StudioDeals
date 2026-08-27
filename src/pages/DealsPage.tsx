import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePipelineStages } from '@/lib/pipeline-stages'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { useToast } from '@/lib/toast-context'
import {
  DEALS_PAGE_SIZE,
  exportDeals,
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
import { ExportButton } from '@/components/ExportButton'
import { centsToCsvNumber, datedFilename, toCsv, toCsvDate } from '@/lib/csv'

const DEAL_TYPE_OPTIONS = [
  { value: '', label: 'All deal types' },
  { value: 'production', label: 'Production' },
  { value: 'prestarter', label: 'Prestarter' },
  { value: 'retainer', label: 'Retainer' },
  { value: 'other', label: 'Other' },
]

const BACK_TO_DEALS = { to: '/deals', label: 'Deals' }

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: '', label: 'All statuses' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
]

export function DealsPage() {
  const navigate = useNavigate()
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

  const buildExport = async () => {
    const { rows: all } = await exportDeals({
      search: debouncedSearch, stageId, dealType, status, wonStageIds, lostStageIds,
      sortColumn: sort.column, ascending: sort.ascending, page: 0,
    })
    const stageLabel = (id: number) => stages.find((s) => s.id === id)?.label ?? ''
    const contents = toCsv(
      ['Deal', 'Organisation', 'Contact', 'Stage', 'Deal type', 'Value (AUD)',
       'Expected close', 'Source', 'Won', 'Lost', 'Lost reason', 'Notes'],
      all.map((deal) => [
        deal.title,
        deal.organisation_name,
        deal.contact_name,
        stageLabel(deal.stage_id),
        deal.deal_type,
        // A plain decimal, not formatCents — a column of "$12,000" is text and
        // does not add up.
        centsToCsvNumber(deal.value_cents),
        toCsvDate(deal.expected_close_date),
        deal.source,
        toCsvDate(deal.won_at),
        toCsvDate(deal.lost_at),
        deal.lost_reason,
        deal.notes,
      ]),
    )
    return { filename: datedFilename('deals'), contents, rows: all.length }
  }

  const toggleSort = (column: DealSortColumn) => {
    setSort((current) => ({ column, ascending: current.column === column ? !current.ascending : true }))
    setPage(0)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Deals</h1>
        <div className="flex items-center gap-3">
          <span className="tabular text-sm" style={{ color: 'var(--text-muted)' }}>
            {total} {total === 1 ? 'deal' : 'deals'}
          </span>
          <ExportButton disabled={stagesLoading} build={buildExport} />
        </div>
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
                    onClick={() => navigate(`/deals/${deal.id}`, { state: { from: BACK_TO_DEALS } })}
                    className="cursor-pointer border-b transition-colors duration-150 last:border-b-0"
                    style={{ borderColor: 'var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-4 py-3 font-medium">{deal.title}</td>
                    <td className="px-4 py-3">
                      {/* stopPropagation so following the link doesn't also
                          trigger the row's own navigation to the deal. */}
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
                          state={{ from: BACK_TO_DEALS }}
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
    </div>
  )
}

const selectClass = 'rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150'
const selectStyle = { borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }
