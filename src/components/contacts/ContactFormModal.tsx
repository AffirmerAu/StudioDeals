import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Modal } from '@/components/Modal'
import { useToast } from '@/lib/toast-context'
import { createContact } from '@/lib/contacts'
import {
  createOrganisation,
  findOrganisationByName,
  type OrganisationOption,
} from '@/lib/organisations'
import { ContactFields } from '@/components/contacts/ContactFields'
import {
  contactFormValues,
  EMPTY_CONTACT_FORM,
  type ContactFormState,
} from '@/components/contacts/contact-form'
import {
  organisationFormValues,
  type OrganisationFormState,
} from '@/components/organisations/organisation-form'
import { newContactEmailHref, NEW_CONTACT_RECIPIENT } from '@/lib/contact-email'
import type { ContactRow } from '@/types/crm'

/** Remembered, because whether you want the prompt is a habit, not a
 *  per-contact decision. */
const EMAIL_ME_KEY = 'studiodeals-email-me-new-contacts'

function storedEmailMe(): boolean {
  // Default on: the whole point of the option is that it is usually wanted.
  return localStorage.getItem(EMAIL_ME_KEY) !== 'false'
}

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
  const [newOrganisation, setNewOrganisation] = useState<OrganisationFormState | null>(null)
  const [emailMe, setEmailMe] = useState(storedEmailMe)
  const [saving, setSaving] = useState(false)

  // A real anchor rather than assigning window.location: nothing here can be
  // eaten by a popup blocker, and the draft is inspectable in the DOM before
  // it is ever opened.
  const draftRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return
    setValues(EMPTY_CONTACT_FORM)
    setOrganisation(initialOrganisation)
    setNewOrganisation(null)
  }, [open, initialOrganisation])

  /**
   * The organisation to file the contact under, creating it first if the form
   * is in that mode.
   *
   * Whatever it resolves to is selected in the form before the contact is
   * written. That matters: if the contact insert then fails, the retry finds
   * an organisation already chosen rather than making a second one.
   */
  const resolveOrganisationId = async (): Promise<string | null> => {
    if (!newOrganisation) return organisation?.id ?? null

    const existing = await findOrganisationByName(newOrganisation.name)
    if (existing) {
      setOrganisation(existing)
      setNewOrganisation(null)
      showToast(`${existing.name} already existed — using it`)
      return existing.id
    }

    const created = await createOrganisation(organisationFormValues(newOrganisation))
    setOrganisation({ id: created.id, name: created.name, industry: created.industry })
    setNewOrganisation(null)
    return created.id
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      // Read before the organisation state is rewritten by resolving it: the
      // draft should describe the organisation as it was typed.
      const draft = draftRef.current?.href
      const created = await createContact(contactFormValues(values, await resolveOrganisationId()))

      // Put the captured href back before clicking: resolving the organisation
      // sets state, and a re-render would otherwise rewrite the link to
      // describe the organisation as saved rather than as typed.
      if (emailMe && draft && draftRef.current) {
        draftRef.current.href = draft
        draftRef.current.click()
      }
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
          newOrganisation={newOrganisation}
          onNewOrganisationChange={setNewOrganisation}
        />

        {/* The hint sits outside the label on purpose, the same way Field does
            it: inside, it is read out as part of the checkbox's name every
            time it takes focus. */}
        <div className="space-y-1">
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <input
              type="checkbox"
              checked={emailMe}
              onChange={(e) => {
                setEmailMe(e.target.checked)
                localStorage.setItem(EMAIL_ME_KEY, String(e.target.checked))
              }}
            />
            Email me the details
          </label>
          <p className="pl-6 text-xs" style={{ color: 'var(--text-subtle)' }}>
            Opens a draft to {NEW_CONTACT_RECIPIENT} with everything filled in.
          </p>
        </div>

        <a
          ref={draftRef}
          href={newContactEmailHref(values, organisation, newOrganisation)}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        >
          Email draft
        </a>

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
