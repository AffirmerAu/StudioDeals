import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/lib/toast-context'
import { createOrganisation } from '@/lib/organisations'
import { OrganisationFields } from '@/components/organisations/OrganisationFields'
import {
  EMPTY_ORGANISATION_FORM,
  organisationFormValues,
  type OrganisationFormState,
} from '@/components/organisations/organisation-form'
import type { OrganisationRow } from '@/types/crm'

interface OrganisationFormModalProps {
  open: boolean
  onClose: () => void
  onCreated: (created: OrganisationRow) => void
}

/**
 * Creating an organisation only — editing happens on the organisation's own
 * page, alongside its contacts, deals and activity.
 */
export function OrganisationFormModal({ open, onClose, onCreated }: OrganisationFormModalProps) {
  const { showToast } = useToast()
  const [values, setValues] = useState<OrganisationFormState>(EMPTY_ORGANISATION_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setValues(EMPTY_ORGANISATION_FORM)
  }, [open])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const created = await createOrganisation(organisationFormValues(values))
      showToast('Organisation created')
      onCreated(created)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to create organisation', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New organisation">
      <form onSubmit={handleSubmit} className="space-y-4">
        <OrganisationFields values={values} onChange={(next) => setValues((v) => ({ ...v, ...next }))} />

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
