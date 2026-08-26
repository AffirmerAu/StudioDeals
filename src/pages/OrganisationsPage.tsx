import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  listIndustries,
  listOrganisations,
  ORGANISATIONS_PAGE_SIZE,
  type OrganisationSortColumn,
} from '@/lib/organisations'
import type { OrganisationSummaryRow } from '@/types/crm'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { formatCents } from '@/lib/format'
import { listDuplicateOrgPairs, mergeOrganisations, type DuplicateOrgPair } from '@/lib/duplicates'
import { CompanyLogo } from '@/components/CompanyLogo'
import { DuplicatesModal, type DuplicateCandidate } from '@/components/merge/DuplicatesModal'
import { DuplicatesBar } from '@/components/merge/DuplicatesBar'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonTableRows } from '@/components/Skeleton'
import { Pagination } from '@/components/Pagination'
import { SortableHeader, type SortState } from '@/components/SortableHeader'
import { OrganisationFormModal } from '@/components/organisations/OrganisationFormModal'

const BACK_TO_ORGANISATIONS = { to: '/organisations', label: 'Organisations' }

function toCandidate(pair: DuplicateOrgPair): DuplicateCandidate {
  return {
    key: `${pair.idA}-${pair.idB}`,
    idA: pair.idA,
    nameA: pair.nameA,
    idB: pair.idB,
    nameB: pair.nameB,
    reason: `${Math.round(pair.score * 100)}% similar`,
  }
}

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
  const [duplicates, setDuplicates] = useState<DuplicateOrgPair[]>([])
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    listIndustries().then(setIndustries).catch(() => setIndustries([]))
  }, [])

  // Fails soft: duplicate detection is a nicety, and before migration 006 the
  // merge function isn't there to act on what it finds anyway.
  useEffect(() => {
    listDuplicateOrgPairs().then(setDuplicates).catch(() => setDuplicates([]))
  }, [refreshKey])

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
        <div className="flex items-center gap-2">
          <DuplicatesBar
            count={duplicates.length}
            noun="duplicate"
            onOpen={() => setDuplicatesOpen(true)}
            from={BACK_TO_ORGANISATIONS}
          />
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150"
          style={{ background: 'var(--color-brand-500)' }}
        >
          New organisation
        </button>
        </div>
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
                  onClick={() => navigate(`/organisations/${org.id}`, { state: { from: BACK_TO_ORGANISATIONS } })}
                  className="cursor-pointer border-b transition-colors duration-150 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <CompanyLogo name={org.name} website={org.website} size={40} />
                      {org.name}
                    </div>
                  </td>
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

      <DuplicatesModal
        open={duplicatesOpen}
        title="Possible duplicates"
        entityLabel="organisation"
        movesAcross="contacts, deals, activities and tags"
        candidates={duplicates.map(toCandidate)}
        merge={mergeOrganisations}
        onClose={() => setDuplicatesOpen(false)}
        onMerged={() => {
          // The merged organisation is gone and the survivor's counts have
          // moved, so both the pair list and the table behind it are stale.
          setRefreshKey((k) => k + 1)
        }}
      />

      <OrganisationFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false)
          navigate(`/organisations/${created.id}`, { state: { from: BACK_TO_ORGANISATIONS } })
        }}
      />
    </div>
  )
}
