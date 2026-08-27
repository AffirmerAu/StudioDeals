import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getOrganisation, updateOrganisation } from '@/lib/organisations'
import { listContactsForOrganisation } from '@/lib/contacts'
import { listDealsForOrganisation } from '@/lib/deals'
import { fetchTagsFor } from '@/lib/tags'
import { fullName } from '@/lib/format'
import { useToast } from '@/lib/toast-context'
import { SkeletonBlock } from '@/components/Skeleton'
import { TagEditor } from '@/components/TagEditor'
import { RecordTasks } from '@/components/RecordTasks'
import { EmptyState } from '@/components/EmptyState'
import { CompanyLogo } from '@/components/CompanyLogo'
import { DealsByStage } from '@/components/DealsByStage'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { BackLink, SaveBar, useBackTarget, type BackTarget } from '@/components/RecordPage'
import { OrganisationFields } from '@/components/organisations/OrganisationFields'
import {
  organisationFormValues,
  toOrganisationFormState,
  type OrganisationFormState,
} from '@/components/organisations/organisation-form'
import type { ContactRow, DealRow, OrganisationRow, TagRow } from '@/types/crm'

export function OrganisationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { showToast } = useToast()
  const back = useBackTarget({ to: '/organisations', label: 'Organisations' })

  const [org, setOrg] = useState<OrganisationRow | null>(null)
  const [tags, setTags] = useState<TagRow[]>([])
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<OrganisationFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [activityKey, setActivityKey] = useState(0)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    Promise.all([
      getOrganisation(id),
      fetchTagsFor({ kind: 'organisation', id }),
      listContactsForOrganisation(id),
      listDealsForOrganisation(id),
    ])
      .then(([orgRow, tagRows, contactRows, dealRows]) => {
        if (cancelled) return
        if (!orgRow) {
          setNotFound(true)
          return
        }
        setOrg(orgRow)
        setForm(toOrganisationFormState(orgRow))
        setTags(tagRows)
        setContacts(contactRows)
        setDeals(dealRows)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load organisation', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const baseline = useMemo(() => (org ? toOrganisationFormState(org) : null), [org])
  const dirty = form !== null && baseline !== null && JSON.stringify(form) !== JSON.stringify(baseline)

  const discard = () => {
    if (org) setForm(toOrganisationFormState(org))
  }

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!org || !form) return

    setSaving(true)
    try {
      const saved = await updateOrganisation(org.id, organisationFormValues(form))
      setOrg(saved)
      setForm(toOrganisationFormState(saved))
      showToast('Organisation updated')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update organisation', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (!id) return null

  if (loading) {
    return (
      <div className="space-y-4 p-8">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    )
  }

  if (notFound || !org || !form) {
    return (
      <div className="p-8">
        <BackLink target={back} />
        <div className="mt-4">
          <EmptyState title="Organisation not found" hint="It may have been deleted or merged away." />
        </div>
      </div>
    )
  }

  const here: BackTarget = { to: `/organisations/${id}`, label: org.name }

  return (
    <div className="p-8 pb-0">
      <div className="max-w-5xl">
        <BackLink target={back} />

        <div className="mt-3 flex items-start gap-3">
          <CompanyLogo name={org.name} website={org.website} size={40} />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{org.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {org.industry && <span>{org.industry}</span>}
              {org.website && (
                <a href={org.website} target="_blank" rel="noreferrer" style={{ color: 'var(--color-brand-500)' }}>
                  {org.website}
                </a>
              )}
              {!org.is_client && <span>Prospect</span>}
            </div>
            <div className="mt-2">
              <TagEditor target={{ kind: 'organisation', id }} tags={tags} onChange={setTags} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight">Details</h2>
            <OrganisationFields values={form} onChange={(next) => setForm((c) => (c ? { ...c, ...next } : c))} />
            {/* Submitting with Enter saves; the visible controls live in the
                SaveBar below so they follow the page rather than the form. */}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>

          <aside className="space-y-6">
            <RecordTasks
              target={{ kind: 'organisation', id }}
              onCompleted={() => setActivityKey((k) => k + 1)}
            />

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
                        state={{ from: here }}
                        className="block rounded-lg border px-3 py-2.5 transition-colors duration-150"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        <p className="truncate text-sm font-medium">
                          {fullName(contact.first_name, contact.last_name)}
                        </p>
                        <p className="truncate text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {contact.role ?? contact.email ?? '—'}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="text-sm font-semibold tracking-tight">Deals</h2>
              <div className="mt-3">
                <DealsByStage deals={deals} backTarget={here} />
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-10 max-w-2xl">
          <h2 className="text-sm font-semibold tracking-tight">Activity</h2>
          <div className="mt-3">
            <ActivityTimeline key={activityKey} organisationId={id} logDefaults={{ organisationId: id }} />
          </div>
        </section>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={() => void handleSave()} onDiscard={discard} />
    </div>
  )
}
