import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { Combobox } from '@/components/Combobox'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABEL,
  countsAsContact,
  createActivity,
  type ActivityFormValues,
} from '@/lib/activities'
import { searchContactsForOrganisation, type ContactOption } from '@/lib/contacts'
import type { ActivityRow } from '@/types/crm'

/** Where the activity is being logged from — fills the FKs the timeline's own
 * filter can't supply (a deal knows its organisation and primary contact). */
export interface ActivityDefaults {
  dealId?: string | null
  organisationId?: string | null
  contactId?: string | null
  contactName?: string | null
}

interface ActivityFormModalProps {
  open: boolean
  defaults: ActivityDefaults
  onClose: () => void
  onSaved: (activity: ActivityRow) => void
}

/** `datetime-local` speaks local wall-clock with no zone; the column is
 * timestamptz. Convert on the way in and out rather than storing the raw
 * input. */
function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function ActivityFormModal({ open, defaults, onClose, onSaved }: ActivityFormModalProps) {
  const { session } = useAuth()
  const { showToast } = useToast()

  const [type, setType] = useState<string>('call')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [dueAt, setDueAt] = useState('')
  const [contact, setContact] = useState<ContactOption | null>(null)
  const [saving, setSaving] = useState(false)

  // Reopening the modal is a fresh log, not a continuation of the last one.
  useEffect(() => {
    if (!open) return
    setType('call')
    setSubject('')
    setNotes('')
    setOccurredAt(toLocalInput(new Date().toISOString()))
    setDueAt('')
    setContact(
      defaults.contactId && defaults.contactName
        ? { id: defaults.contactId, first_name: defaults.contactName, last_name: null }
        : null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The contact picker is only meaningful when we know which organisation to
  // search within; the contact drawer already pins one, so it's hidden there.
  const showContactPicker = !defaults.contactId && Boolean(defaults.organisationId)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)

    const values: ActivityFormValues = {
      type,
      subject: subject.trim() || null,
      notes: notes.trim() || null,
      occurred_at: fromLocalInput(occurredAt) ?? new Date().toISOString(),
      due_at: fromLocalInput(dueAt),
      deal_id: defaults.dealId ?? null,
      organisation_id: defaults.organisationId ?? null,
      contact_id: contact?.id ?? defaults.contactId ?? null,
    }

    try {
      const saved = await createActivity(values, session?.user.id ?? null)
      onSaved(saved)
      showToast(`${ACTIVITY_TYPE_LABEL[type] ?? 'Activity'} logged`)
      onClose()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to log activity', 'error')
    } finally {
      setSaving(false)
    }
  }

  // Warn rather than block: logging is still valid, it just won't refresh the
  // contact's last-contacted date, which is easy to expect and not get.
  const contactless = countsAsContact(type) && !contact && !defaults.contactId

  return (
    <Modal open={open} onClose={onClose} title="Log activity">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type" htmlFor="activity-type" required>
            <select id="activity-type" value={type} onChange={(e) => setType(e.target.value)} className={inputClass} style={inputStyle}>
              {ACTIVITY_TYPES.map((value) => (
                <option key={value} value={value}>
                  {ACTIVITY_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="When" htmlFor="activity-occurred" required>
            <input
              id="activity-occurred"
              type="datetime-local"
              required
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        {showContactPicker && (
          <Field label="Contact" htmlFor="activity-contact">
            <Combobox<ContactOption>
              value={contact}
              onChange={setContact}
              search={(q) => searchContactsForOrganisation(defaults.organisationId as string, q)}
              getLabel={(c) => [c.first_name, c.last_name].filter(Boolean).join(' ')}
              getKey={(c) => c.id}
              id="activity-contact"
              placeholder="Search contacts…"
            />
          </Field>
        )}

        {contactless && (
          <p className="text-xs" style={{ color: 'var(--color-stage-verbal)' }}>
            No contact selected — this won't update anyone's last-contacted date.
          </p>
        )}

        <Field label="Subject" htmlFor="activity-subject">
          <input
            id="activity-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={ACTIVITY_TYPE_LABEL[type]}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Notes" htmlFor="activity-notes">
          <textarea
            id="activity-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Follow-up due (optional)" htmlFor="activity-due">
          <input
            id="activity-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-150"
            style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors duration-150 disabled:opacity-60"
            style={{ background: 'var(--color-brand-500)' }}
          >
            {saving ? 'Saving…' : 'Log'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150'
const inputStyle = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string
  htmlFor: string
  required?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  )
}
