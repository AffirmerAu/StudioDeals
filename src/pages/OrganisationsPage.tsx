import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listIndustries,
  listOrganisations,
  ORGANISATIONS_PAGE_SIZE,
  type OrganisationSortColumn,
} from '@/lib/organisations'
import type { OrganisationSummaryRow } from '@/types/database'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { formatCents } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonTableRows } from '@/components/Skeleton'
import { Pagination } from '@/components/Pagination'
import { SortableHeader, type SortState } from '@/components/SortableHeader'
import { OrganisationFormModal } from '@/components/organisations/OrganisationFormModal'

export function OrganisationsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [industry, setIndustry] = useState<string | null>(null)
  const [industries, setIndustries] = useState<string[]>([])
  const [showAll, setShowAll] = useState(false)
  const [sort, setSort] = useState<SortState<OrganisationSortColumn>>({ column: 'name', ascending: true })
  const [page, setPage] = useState(0)

  const [rows, setRows] = useState<OrganisationSummaryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    listIndustries().then(setIndustries).catch(() => setIndustries([]))
  }, [])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, industry, showAll])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listOrganisations({
      search: debouncedSearch,
      industry,
      showAll,
      sortColumn: sort.column,
      ascending: sort.ascending,
      page,
    })
      .then((result) => {
        if (cancelled) return
        setRows(result.rows)
        setTotal(result.total)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedSearch, industry, showAll, sort, page, refreshKey])

  const handleSort = (column: OrganisationSortColumn) => {
    setSort((current) =>
      current.column === column ? { column, ascending: !current.ascending } : { column, ascending: true },
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Organisations</h1>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--color-brand-500)' }}
        >
          New organisation
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="w-64 rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        />

        <select
          value={industry ?? ''}
          onChange={(e) => setIndustry(e.target.value || null)}
          className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        >
          <option value="">All industries</option>
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show all (incl. non-clients)
        </label>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <SortableHeader column="name" label="Name" sort={sort} onSort={handleSort} />
              <SortableHeader column="industry" label="Industry" sort={sort} onSort={handleSort} />
              <SortableHeader column="contact_count" label="Contacts" sort={sort} onSort={handleSort} align="right" />
              <SortableHeader
                column="open_deal_count"
                label="Open deals"
                sort={sort}
                onSort={handleSort}
                align="right"
              />
              <SortableHeader
                column="won_value_cents"
                label="Won value"
                sort={sort}
                onSort={handleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonTableRows rows={10} cols={5} />}
            {!loading &&
              rows.map((org) => (
                <tr
                  key={org.id}
                  onClick={() => navigate(`/organisations/${org.id}`)}
                  className="cursor-pointer border-b transition-colors duration-150 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 font-medium">{org.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {org.industry ?? '—'}
                  </td>
                  <td className="tabular px-4 py-3 text-right">{org.contact_count}</td>
                  <td className="tabular px-4 py-3 text-right">{org.open_deal_count}</td>
                  <td className="tabular px-4 py-3 text-right">{formatCents(org.won_value_cents)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState title="No organisations found" hint="Try a different search or filter." />
        )}
      </div>

      {!loading && rows.length > 0 && (
        <Pagination page={page} pageSize={ORGANISATIONS_PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <OrganisationFormModal
        open={addOpen}
        organisation={null}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          setPage(0)
          setRefreshKey((k) => k + 1)
        }}
      />
    </div>
  )
}
