import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/lib/toast-context'
import { createContact } from '@/lib/contacts'
import type { OrganisationOption } from '@/lib/organisations'
import { ContactFields } from '@/components/contacts/ContactFields'
import {
  contactFormValues,
  EMPTY_CONTACT_FORM,
  type ContactFormState,
} from '@/components/contacts/contact-form'
import type { ContactRow } from '@/types/crm'

interface ContactFormModalProps {
  open: boolean
  initialOrganisation?: OrganisationOption | null
  onClose: () => void
  onCreated: (created: ContactRow) => void
}

/**
 * Creating a contact only — editing happens on the contact's own page,
 * alongside their deals and activity.
 */
export function ContactFormModal({
  open,
  initialOrganisation = null,
  onClose,
  onCreated,
}: ContactFormModalProps) {
  const { showToast } = useToast()
  const [values, setValues] = useState<ContactFormState>(EMPTY_CONTACT_FORM)
  const [organisation, setOrganisation] = useState<OrganisationOption | null>(initialOrganisation)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues(EMPTY_CONTACT_FORM)
    setOrganisation(initialOrganisation)
  }, [open, initialOrganisation])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const created = await createContact(contactFormValues(values, organisation?.id ?? null))
      showToast('Contact created')
      onCreated(created)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create contact', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ContactFields
          values={values}
          onChange={(next) => setValues((v) => ({ ...v, ...next }))}
          organisation={organisation}
          onOrganisationChange={setOrganisation}
        />

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
