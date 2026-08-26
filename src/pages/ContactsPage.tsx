import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CONTACTS_PAGE_SIZE,
  listContacts,
  type ContactSortColumn,
} from '@/lib/contacts'
import { searchOrganisations, type OrganisationOption } from '@/lib/organisations'
import { useTags } from '@/lib/tags'
import { useDebouncedValue } from '@/lib/use-debounced-value'
import { fullName, formatRelativeDays } from '@/lib/format'
import { EmptyState } from '@/components/EmptyState'
import { SkeletonTableRows } from '@/components/Skeleton'
import { Pagination } from '@/components/Pagination'
import { SortableHeader, type SortState } from '@/components/SortableHeader'
import { Combobox } from '@/components/Combobox'
import { ContactFormModal } from '@/components/contacts/ContactFormModal'
import { DuplicatesModal, type DuplicateCandidate } from '@/components/merge/DuplicatesModal'
import { DuplicatesBar } from '@/components/merge/DuplicatesBar'
import { listDuplicateContactPairs, mergeContacts, type DuplicateContactPair } from '@/lib/duplicates'
import type { ContactListRow } from '@/types/crm'

const BACK_TO_CONTACTS = { to: '/contacts', label: 'Contacts' }

function toCandidate(pair: DuplicateContactPair): DuplicateCandidate {
  return {
    key: `${pair.idA}-${pair.idB}`,
    idA: pair.idA,
    nameA: pair.nameA,
    idB: pair.idB,
    nameB: pair.nameB,
    detailA: pair.emailA,
    detailB: pair.emailB,
    // An email match is exact, so a percentage would be noise; a name match
    // only ever surfaces within one organisation, which is worth naming.
    reason: pair.matchOn === 'email' ? 'Same email' : `${Math.round(pair.score * 100)}% similar`,
    context: pair.matchOn === 'name' ? pair.organisationName : null,
  }
}

export function ContactsPage() {
  const navigate = useNavigate()

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [organisation, setOrganisation] = useState<OrganisationOption | null>(null)
  const [tagId, setTagId] = useState<number | null>(null)
  const { tags } = useTags()
  const [sort, setSort] = useState<SortState<ContactSortColumn>>({ column: 'first_name', ascending: true })
  const [page, setPage] = useState(0)

  const [rows, setRows] = useState<ContactListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [duplicates, setDuplicates] = useState<DuplicateContactPair[]>([])
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Fails soft: duplicate detection is a nicety, and before migration 007 the
  // view isn't there to consult nor the function there to act on it.
  useEffect(() => {
    listDuplicateContactPairs().then(setDuplicates).catch(() => setDuplicates([]))
  }, [refreshKey])

  useEffect(() => {
    setPage(0)
  }, [debouncedSearch, organisation, tagId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listContacts({
      search: debouncedSearch,
      organisationId: organisation?.id ?? null,
      tagId,
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
  }, [debouncedSearch, organisation, tagId, sort, page, refreshKey])

  const handleSort = (column: ContactSortColumn) => {
    setSort((current) =>
      current.column === column ? { column, ascending: !current.ascending } : { column, ascending: true },
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">Contacts</h1>
        <div className="flex items-center gap-2">
          <DuplicatesBar
            count={duplicates.length}
            noun="duplicate"
            onOpen={() => setDuplicatesOpen(true)}
            from={BACK_TO_CONTACTS}
          />
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150"
            style={{ background: 'var(--color-brand-500)' }}
          >
            New contact
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-start gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, organisation…"
          className="w-72 rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        />

        <div className="w-56">
          <Combobox<OrganisationOption>
            value={organisation}
            onChange={setOrganisation}
            search={(q) => searchOrganisations(q)}
            getLabel={(o) => o.name}
            getKey={(o) => o.id}
            placeholder="Filter by organisation…"
          />
        </div>

        <select
          value={tagId ?? ''}
          onChange={(e) => setTagId(e.target.value ? Number(e.target.value) : null)}
          className="rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)', color: 'var(--text)' }}
        >
          <option value="">All tags</option>
          {tags.map((tag) => (
            <option key={tag.id} value={tag.id}>
              {tag.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
              <SortableHeader column="first_name" label="Name" sort={sort} onSort={handleSort} />
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                Role
              </th>
              <SortableHeader column="organisation_name" label="Organisation" sort={sort} onSort={handleSort} />
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                Email
              </th>
              <th className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>
                Phone
              </th>
              <SortableHeader column="last_contacted_at" label="Last contacted" sort={sort} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {loading && <SkeletonTableRows rows={10} cols={6} />}
            {!loading &&
              rows.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => navigate(`/contacts/${contact.id}`, { state: { from: BACK_TO_CONTACTS } })}
                  className="cursor-pointer border-b transition-colors duration-150 last:border-b-0"
                  style={{ borderColor: 'var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-4 py-3 font-medium">{fullName(contact.first_name, contact.last_name)}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {contact.role ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {contact.organisation_name ?? '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {contact.email ?? '—'}
                  </td>
                  <td className="tabular px-4 py-3" style={{ color: 'var(--text-muted)' }}>
                    {contact.phone ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: contact.is_stale ? 'var(--color-stage-verbal)' : 'var(--text-muted)' }}
                    >
                      {contact.is_stale && <span className="size-1.5 rounded-lg" style={{ background: 'var(--color-stage-verbal)' }} />}
                      {formatRelativeDays(contact.last_contacted_at)}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState title="No contacts found" hint="Try a different search or filter." />
        )}
      </div>

      {!loading && rows.length > 0 && (
        <Pagination page={page} pageSize={CONTACTS_PAGE_SIZE} total={total} onPageChange={setPage} />
      )}

      <DuplicatesModal
        open={duplicatesOpen}
        title="Possible duplicate contacts"
        entityLabel="contact"
        movesAcross="deals, activities and tags"
        candidates={duplicates.map(toCandidate)}
        merge={mergeContacts}
        onClose={() => setDuplicatesOpen(false)}
        onMerged={() => setRefreshKey((k) => k + 1)}
      />

      <ContactFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(created) => {
          setAddOpen(false)
          navigate(`/contacts/${created.id}`, { state: { from: BACK_TO_CONTACTS } })
        }}
      />
    </div>
  )
}
