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
  updateActivity,
  type ActivityFormValues,
  type TimelineActivityRow,
} from '@/lib/activities'
import { searchContactsForOrganisation, type ContactOption } from '@/lib/contacts'

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
  /** Set to edit an existing activity instead of logging a new one. */
  activity?: TimelineActivityRow | null
  onClose: () => void
  onSaved: (activity: TimelineActivityRow) => void
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

export function ActivityFormModal({ open, defaults, activity, onClose, onSaved }: ActivityFormModalProps) {
  const editing = Boolean(activity)
  const { session } = useAuth()
  const { showToast } = useToast()

  const [type, setType] = useState<string>('call')
  const [subject, setSubject] = useState('')
  const [notes, setNotes] = useState('')
  const [occurredAt, setOccurredAt] = useState(() => toLocalInput(new Date().toISOString()))
  const [dueAt, setDueAt] = useState('')
  const [contact, setContact] = useState<ContactOption | null>(null)
  const [saving, setSaving] = useState(false)

  // Reopening is either a fresh log or a fresh edit — never a continuation of
  // whatever was in the form last time.
  useEffect(() => {
    if (!open) return
    if (activity) {
      setType(activity.type)
      setSubject(activity.subject ?? '')
      setNotes(activity.notes ?? '')
      setOccurredAt(toLocalInput(activity.occurred_at))
      setDueAt(activity.due_at ? toLocalInput(activity.due_at) : '')
      setContact(
        activity.contact_id && activity.contact_name
          ? { id: activity.contact_id, first_name: activity.contact_name, last_name: null }
          : null,
      )
      return
    }
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
  }, [open, activity?.id])

  // The picker needs an organisation to search within. When editing, the
  // activity's own organisation stands in for the surface's default.
  const pickerOrganisationId = (editing ? activity?.organisation_id : null) ?? defaults.organisationId ?? null
  // A contact pinned by the surface itself (the contact drawer) isn't
  // changeable; an inferred or existing one is.
  const showContactPicker = Boolean(pickerOrganisationId) && !(!editing && defaults.contactId)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)

    const values: ActivityFormValues = {
      type,
      subject: subject.trim() || null,
      notes: notes.trim() || null,
      occurred_at: fromLocalInput(occurredAt) ?? new Date().toISOString(),
      due_at: fromLocalInput(dueAt),
      // An edit keeps whatever it was already attached to; only the contact
      // is changeable, since that's the one that gets mis-picked.
      deal_id: (editing ? activity?.deal_id : defaults.dealId) ?? null,
      organisation_id: (editing ? activity?.organisation_id : defaults.organisationId) ?? null,
      contact_id: contact?.id ?? (editing ? null : defaults.contactId) ?? null,
    }

    try {
      const saved = activity
        ? await updateActivity(activity.id, values)
        : await createActivity(values, session?.user.id ?? null)
      onSaved(saved)
      showToast(editing ? 'Activity updated' : `${ACTIVITY_TYPE_LABEL[type] ?? 'Activity'} logged`)
      onClose()
    } catch (error) {
      const verb = editing ? 'update' : 'log'
      showToast(error instanceof Error ? error.message : `Failed to ${verb} activity`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Warn rather than block: logging is still valid, it just won't refresh the
  // contact's last-contacted date, which is easy to expect and not get.
  const contactless = countsAsContact(type) && !contact && !(editing ? false : defaults.contactId)

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit activity' : 'Log activity'}>
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
              search={(q) => searchContactsForOrganisation(pickerOrganisationId as string, q)}
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
            {saving ? 'Saving…' : editing ? 'Save' : 'Log'}
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
