import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Modal } from '@/components/Modal'
import { Combobox } from '@/components/Combobox'
import { useToast } from '@/lib/toast-context'
import { createContact, updateContact, type ContactFormValues } from '@/lib/contacts'
import { searchOrganisations, type OrganisationOption } from '@/lib/organisations'
import type { ContactRow } from '@/types/crm'

interface ContactFormModalProps {
  open: boolean
  contact: ContactRow | null
  initialOrganisation?: OrganisationOption | null
  onClose: () => void
  /** Called with the saved row once persisted (edits fire this optimistically, before the request resolves). */
  onSaved: (saved: ContactRow) => void
  /** Called only for edits, if the background save fails — use it to roll the optimistic update back. */
  onSaveFailed?: (previous: ContactRow) => void
}

type FormState = Omit<ContactFormValues, 'organisation_id'>

const EMPTY_VALUES: FormState = {
  first_name: '',
  last_name: '',
  role: '',
  email: '',
  phone: '',
  is_primary: false,
  notes: '',
}

function toFormValues(contact: ContactRow | null): FormState {
  if (!contact) return EMPTY_VALUES
  return {
    first_name: contact.first_name,
    last_name: contact.last_name ?? '',
    role: contact.role ?? '',
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    is_primary: contact.is_primary,
    notes: contact.notes ?? '',
  }
}

function normalise(values: FormState, organisationId: string | null): ContactFormValues {
  return {
    ...values,
    last_name: values.last_name?.trim() || null,
    role: values.role?.trim() || null,
    email: values.email?.trim() || null,
    phone: values.phone?.trim() || null,
    notes: values.notes?.trim() || null,
    organisation_id: organisationId,
  }
}

export function ContactFormModal({
  open,
  contact,
  initialOrganisation = null,
  onClose,
  onSaved,
  onSaveFailed,
}: ContactFormModalProps) {
  const { showToast } = useToast()
  const [values, setValues] = useState<FormState>(() => toFormValues(contact))
  const [organisation, setOrganisation] = useState<OrganisationOption | null>(initialOrganisation)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setValues(toFormValues(contact))
      setOrganisation(initialOrganisation)
    }
  }, [open, contact, initialOrganisation])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const cleaned = normalise(values, organisation?.id ?? null)

    if (contact) {
      onSaved({ ...contact, ...cleaned })
      updateContact(contact.id, cleaned)
        .then(() => showToast('Contact updated'))
        .catch((error: unknown) => {
          onSaveFailed?.(contact)
          showToast(error instanceof Error ? error.message : 'Failed to update contact', 'error')
        })
      return
    }

    setSaving(true)
    try {
      const created = await createContact(cleaned)
      showToast('Contact created')
      onSaved(created)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create contact', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={contact ? 'Edit contact' : 'New contact'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="First name" required>
            <input
              required
              value={values.first_name}
              onChange={(e) => setValues((v) => ({ ...v, first_name: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Last name">
            <input
              value={values.last_name ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, last_name: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <Field label="Organisation">
          <Combobox<OrganisationOption>
            value={organisation}
            onChange={setOrganisation}
            search={(q) => searchOrganisations(q)}
            getLabel={(o) => o.name}
            getKey={(o) => o.id}
            placeholder="Search organisations…"
          />
        </Field>

        <Field label="Role">
          <input
            value={values.role ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Email">
            <input
              type="email"
              value={values.email ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Phone">
            <input
              value={values.phone ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
              className={inputClass}
              style={inputStyle}
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <input
            type="checkbox"
            checked={values.is_primary}
            onChange={(e) => setValues((v) => ({ ...v, is_primary: e.target.checked }))}
          />
          Primary contact
        </label>

        <Field label="Notes">
          <textarea
            value={values.notes ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
            rows={3}
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
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors duration-150'
const inputStyle = { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text)' }

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
        {label}
        {required && ' *'}
      </label>
      {children}
    </div>
  )
}
