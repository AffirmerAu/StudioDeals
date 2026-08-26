import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '@/lib/toast-context'
import { deleteContact, getContact, updateContact } from '@/lib/contacts'
import { fetchTagsFor } from '@/lib/tags'
import { listDealsForContact } from '@/lib/deals'
import { fullName, formatRelativeDays } from '@/lib/format'
import type { OrganisationOption } from '@/lib/organisations'
import { SkeletonBlock } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DealsByStage } from '@/components/DealsByStage'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { TagEditor } from '@/components/TagEditor'
import { BackLink, MetaRow, SaveBar, useBackTarget, type BackTarget } from '@/components/RecordPage'
import { ContactFields } from '@/components/contacts/ContactFields'
import {
  contactFormValues,
  toContactFormState,
  type ContactFormState,
} from '@/components/contacts/contact-form'
import type { ContactListRow, DealRow, TagRow } from '@/types/crm'

function toOrganisationOption(contact: ContactListRow): OrganisationOption | null {
  if (!contact.organisation_id) return null
  return { id: contact.organisation_id, name: contact.organisation_name ?? '—', industry: null }
}

export function ContactDetailPage() {
  const { contactId } = useParams<{ contactId: string }>()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const back = useBackTarget({ to: '/contacts', label: 'Contacts' })

  const [contact, setContact] = useState<ContactListRow | null>(null)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [tags, setTags] = useState<TagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [form, setForm] = useState<ContactFormState | null>(null)
  const [organisation, setOrganisation] = useState<OrganisationOption | null>(null)
  const [saving, setSaving] = useState(false)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  useEffect(() => {
    if (!contactId) return
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    Promise.all([
      getContact(contactId),
      listDealsForContact(contactId),
      fetchTagsFor({ kind: 'contact', id: contactId }),
    ])
      .then(([row, dealRows, tagRows]) => {
        if (cancelled) return
        if (!row) {
          setNotFound(true)
          return
        }
        setContact(row)
        setForm(toContactFormState(row))
        setOrganisation(toOrganisationOption(row))
        setDeals(dealRows)
        setTags(tagRows)
      })
      .catch((error: unknown) => {
        if (!cancelled) showToast(error instanceof Error ? error.message : 'Failed to load contact', 'error')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId])

  const baseline = useMemo(() => (contact ? toContactFormState(contact) : null), [contact])
  const dirty =
    form !== null &&
    baseline !== null &&
    (JSON.stringify(form) !== JSON.stringify(baseline) ||
      (organisation?.id ?? null) !== contact?.organisation_id)

  const discard = () => {
    if (!contact) return
    setForm(toContactFormState(contact))
    setOrganisation(toOrganisationOption(contact))
  }

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!contact || !form) return

    const values = contactFormValues(form, organisation?.id ?? null)
    setSaving(true)
    try {
      const saved = await updateContact(contact.id, values)
      // updateContact returns the base table row; the page reads the view row,
      // so the derived columns (organisation_name, is_stale, last_contacted_at)
      // are kept and only the edited fields are folded in.
      const merged: ContactListRow = {
        ...contact,
        ...saved,
        organisation_name: organisation?.name ?? null,
      }
      setContact(merged)
      setForm(toContactFormState(merged))
      showToast('Contact updated')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to update contact', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!contact) return
    setDeleteBusy(true)
    try {
      await deleteContact(contact.id)
      showToast('Contact deleted')
      navigate(back.to)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete contact', 'error')
      setDeleteBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-8">
        <SkeletonBlock className="h-8 w-64" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    )
  }

  if (notFound || !contact || !form) {
    return (
      <div className="p-8">
        <BackLink target={back} />
        <div className="mt-4">
          <EmptyState title="Contact not found" hint="It may have been deleted." />
        </div>
      </div>
    )
  }

  const here: BackTarget = { to: `/contacts/${contact.id}`, label: fullName(contact.first_name, contact.last_name) }

  return (
    <div className="p-8 pb-0">
      <div className="max-w-5xl">
        <BackLink target={back} />

        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {fullName(contact.first_name, contact.last_name)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {contact.role && <span>{contact.role}</span>}
              {contact.organisation_id && (
                <Link to={`/organisations/${contact.organisation_id}`} style={{ color: 'var(--color-brand-500)' }}>
                  {contact.organisation_name ?? '—'}
                </Link>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} style={{ color: 'var(--color-brand-500)' }}>
                  {contact.email}
                </a>
              )}
            </div>
            <div className="mt-2">
              <TagEditor target={{ kind: 'contact', id: contact.id }} tags={tags} onChange={setTags} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--color-stage-lost)' }}
          >
            Delete
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <form onSubmit={handleSave} className="space-y-4">
            <h2 className="text-sm font-semibold tracking-tight">Details</h2>
            <ContactFields
              values={form}
              onChange={(next) => setForm((current) => (current ? { ...current, ...next } : current))}
              organisation={organisation}
              onOrganisationChange={setOrganisation}
            />
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>

          <aside className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold tracking-tight">Record</h2>
              {/* Derived from the activity log, not something you can type —
                  everything editable lives in the form beside it. */}
              <dl className="mt-3 space-y-2.5">
                <MetaRow label="Last contacted">
                  <span style={{ color: contact.is_stale ? 'var(--color-stage-verbal)' : undefined }}>
                    {formatRelativeDays(contact.last_contacted_at)}
                  </span>
                </MetaRow>
              </dl>
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
            <ActivityTimeline
              contactId={contact.id}
              logDefaults={{ contactId: contact.id, organisationId: contact.organisation_id }}
            />
          </div>
        </section>
      </div>

      <SaveBar dirty={dirty} saving={saving} onSave={() => void handleSave()} onDiscard={discard} />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete contact"
        message={`Delete ${fullName(contact.first_name, contact.last_name)}? This can't be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleteBusy}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  )
}
