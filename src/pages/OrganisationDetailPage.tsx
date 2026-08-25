import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getOrganisation } from '@/lib/organisations'
import { listContactsForOrganisation } from '@/lib/contacts'
import { listDealsForOrganisation } from '@/lib/deals'
import { fetchOrganisationTags } from '@/lib/tags'
import { fullName } from '@/lib/format'
import { SkeletonBlock } from '@/components/Skeleton'
import { TagPill } from '@/components/TagPill'
import { EmptyState } from '@/components/EmptyState'
import { DealsByStage } from '@/components/DealsByStage'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { OrganisationFormModal } from '@/components/organisations/OrganisationFormModal'
import type { ContactRow, DealRow, OrganisationRow, TagRow } from '@/types/crm'

export function OrganisationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [org, setOrg] = useState<OrganisationRow | null>(null)
  const [tags, setTags] = useState<TagRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    Promise.all([getOrganisation(id), fetchOrganisationTags(id), listContactsForOrganisation(id), listDealsForOrganisation(id)])
      .then(([orgRow, tagRows, contactRows, dealRows]) => {
        if (cancelled) return
        if (!orgRow) {
          setNotFound(true)
          return
        }
        setOrg(orgRow)
        setTags(tagRows)
        setContacts(contactRows)
        setDeals(dealRows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  if (!id) return null

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-40 w-full" />
      </div>
    )
  }

  if (notFound || !org) {
    return (
      <div className="p-8">
        <EmptyState title="Organisation not found" hint="It may have been deleted." />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <button
        type="button"
        onClick={() => navigate('/organisations')}
        className="text-sm transition-colors duration-150"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Organisations
      </button>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            {org.industry && <span>{org.industry}</span>}
            {org.website && (
              <a
                href={org.website}
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-brand-500)' }}
              >
                {org.website}
              </a>
            )}
            {org.abn && <span className="tabular">ABN {org.abn}</span>}
            {org.account_number && <span className="tabular">{org.account_number}</span>}
          </div>
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <TagPill key={tag.id} label={tag.label} />
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
          style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Edit
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold tracking-tight">Contacts</h2>
          {contacts.length === 0 ? (
            <div className="mt-2">
              <EmptyState title="No contacts yet" />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <Link
                    to={`/contacts/${contact.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{fullName(contact.first_name, contact.last_name)}</p>
                      {contact.role && (
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {contact.role}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {contact.email ?? '—'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold tracking-tight">Deals</h2>
          <div className="mt-3">
            <DealsByStage deals={deals} />
          </div>
        </section>
      </div>

      <section className="mt-8 max-w-2xl">
        <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
        <div className="mt-3">
          <ActivityTimeline organisationId={id} logDefaults={{ organisationId: id }} />
        </div>
      </section>

      <OrganisationFormModal
        open={editOpen}
        organisation={org}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setOrg(saved)
          setEditOpen(false)
        }}
        onSaveFailed={(previous) => setOrg(previous)}
      />
    </div>
  )
}
