import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Drawer } from '@/components/Drawer'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ActivityTimeline } from '@/components/ActivityTimeline'
import { DealsByStage } from '@/components/DealsByStage'
import { SkeletonBlock } from '@/components/Skeleton'
import { ContactFormModal } from '@/components/contacts/ContactFormModal'
import { deleteContact, getContact } from '@/lib/contacts'
import { listDealsForContact } from '@/lib/deals'
import { fullName, formatRelativeDays } from '@/lib/format'
import { useToast } from '@/lib/toast-context'
import type { ContactListRow, DealRow } from '@/types/database'

interface ContactDetailDrawerProps {
  contactId: string | null
  onClose: () => void
  /** Fires after an edit or delete, so the caller can refresh its list. */
  onChanged: () => void
}

export function ContactDetailDrawer({ contactId, onClose, onChanged }: ContactDetailDrawerProps) {
  const { showToast } = useToast()
  const [contact, setContact] = useState<ContactListRow | null>(null)
  const [deals, setDeals] = useState<DealRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!contactId) return
    let cancelled = false
    setLoading(true)
    setContact(null)
    Promise.all([getContact(contactId), listDealsForContact(contactId)])
      .then(([contactRow, dealRows]) => {
        if (cancelled) return
        setContact(contactRow)
        setDeals(dealRows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [contactId])

  const handleDelete = async () => {
    if (!contact) return
    setDeleting(true)
    try {
      await deleteContact(contact.id)
      showToast('Contact deleted')
      setDeleteOpen(false)
      onChanged()
      onClose()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to delete contact', 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Drawer open={contactId !== null} onClose={onClose} title={contact ? fullName(contact.first_name, contact.last_name) : 'Contact'}>
        {loading && (
          <div className="space-y-4">
            <SkeletonBlock className="h-6 w-40" />
            <SkeletonBlock className="h-24 w-full" />
            <SkeletonBlock className="h-32 w-full" />
          </div>
        )}

        {!loading && contact && (
          <div className="space-y-6">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
                style={{ borderColor: 'var(--border)', color: 'var(--color-stage-lost)' }}
              >
                Delete
              </button>
            </div>

            <dl className="space-y-2.5 text-sm">
              <Row label="Role" value={contact.role ?? '—'} />
              <Row
                label="Organisation"
                value={
                  contact.organisation_id ? (
                    <Link to={`/organisations/${contact.organisation_id}`} style={{ color: 'var(--color-brand-500)' }}>
                      {contact.organisation_name ?? '—'}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <Row label="Email" value={contact.email ?? '—'} />
              <Row label="Phone" value={<span className="tabular">{contact.phone ?? '—'}</span>} />
              <Row
                label="Last contacted"
                value={
                  <span style={{ color: contact.is_stale ? 'var(--color-stage-verbal)' : undefined }}>
                    {formatRelativeDays(contact.last_contacted_at)}
                  </span>
                }
              />
              {contact.notes && <Row label="Notes" value={contact.notes} />}
            </dl>

            <section>
              <h3 className="text-sm font-semibold tracking-tight">Deals</h3>
              <div className="mt-3">
                <DealsByStage deals={deals} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold tracking-tight">Activity</h3>
              <div className="mt-3">
                <ActivityTimeline contactId={contact.id} />
              </div>
            </section>
          </div>
        )}
      </Drawer>

      <ContactFormModal
        open={editOpen}
        contact={contact}
        initialOrganisation={
          contact?.organisation_id && contact.organisation_name
            ? { id: contact.organisation_id, name: contact.organisation_name, industry: null }
            : null
        }
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setContact((current) => (current ? { ...current, ...saved } : current))
          setEditOpen(false)
          onChanged()
        }}
        onSaveFailed={(previous) => setContact((current) => (current ? { ...current, ...previous } : current))}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Delete contact"
        message={`Delete ${contact ? fullName(contact.first_name, contact.last_name) : 'this contact'}? This can't be undone.`}
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: 'var(--text-subtle)' }}>{label}</dt>
      <dd className="text-right" style={{ color: 'var(--text)' }}>
        {value}
      </dd>
    </div>
  )
}
