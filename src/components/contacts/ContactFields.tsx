import { Combobox } from '@/components/Combobox'
import { Field, inputClass, inputStyle } from '@/components/form'
import { searchOrganisations, type OrganisationOption } from '@/lib/organisations'
import { OrganisationFields } from '@/components/organisations/OrganisationFields'
import {
  EMPTY_ORGANISATION_FORM,
  type OrganisationFormState,
} from '@/components/organisations/organisation-form'
import type { ContactFormState } from '@/components/contacts/contact-form'

interface ContactFieldsProps {
  values: ContactFormState
  onChange: (next: Partial<ContactFormState>) => void
  organisation: OrganisationOption | null
  onOrganisationChange: (next: OrganisationOption | null) => void
  /**
   * A draft organisation to create along with the contact, or null to pick an
   * existing one. Pass the handler to offer the choice at all — the contact
   * page leaves it out, because an organisation you are editing a contact
   * into already exists.
   */
  newOrganisation?: OrganisationFormState | null
  onNewOrganisationChange?: (next: OrganisationFormState | null) => void
}

/**
 * The contact's editable fields, shared by the create modal and the contact
 * page so the two can't drift.
 */
export function ContactFields({
  values,
  onChange,
  organisation,
  onOrganisationChange,
  newOrganisation = null,
  onNewOrganisationChange,
}: ContactFieldsProps) {
  const canCreate = onNewOrganisationChange !== undefined
  const creating = newOrganisation !== null

  // Switching away from one keeps the other's answer, so a mis-click costs
  // nothing: the typed draft survives a look through the existing list.
  const startCreating = () => onNewOrganisationChange?.({ ...EMPTY_ORGANISATION_FORM, name: '' })
  const stopCreating = () => onNewOrganisationChange?.(null)

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" required>
          <input
            required
            value={values.first_name}
            onChange={(e) => onChange({ first_name: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field label="Last name">
          <input
            value={values.last_name ?? ''}
            onChange={(e) => onChange({ last_name: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          {creating ? (
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              New organisation
            </span>
          ) : (
            <label htmlFor="contact-organisation" className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Organisation
            </label>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={creating ? stopCreating : startCreating}
              className="cursor-pointer text-xs font-medium transition-colors duration-150"
              style={{ color: 'var(--color-brand-500)' }}
            >
              {creating ? 'Find an existing one' : 'Create a new one'}
            </button>
          )}
        </div>

        {creating ? (
          <div className="space-y-4 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <OrganisationFields
              values={newOrganisation}
              onChange={(next) => onNewOrganisationChange?.({ ...newOrganisation, ...next })}
            />
          </div>
        ) : (
          <Combobox<OrganisationOption>
            id="contact-organisation"
            value={organisation}
            onChange={onOrganisationChange}
            search={(q) => searchOrganisations(q)}
            getLabel={(o) => o.name}
            getKey={(o) => o.id}
            placeholder="Search organisations…"
          />
        )}
      </div>

      <Field label="Role">
        <input
          value={values.role ?? ''}
          onChange={(e) => onChange({ role: e.target.value })}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Email">
          <input
            type="email"
            value={values.email ?? ''}
            onChange={(e) => onChange({ email: e.target.value })}
            className={inputClass}
            style={inputStyle}
          />
        </Field>
        <Field label="Phone">
          <input
            value={values.phone ?? ''}
            onChange={(e) => onChange({ phone: e.target.value })}
            className={`tabular ${inputClass}`}
            style={inputStyle}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
        <input
          type="checkbox"
          checked={values.is_primary}
          onChange={(e) => onChange({ is_primary: e.target.checked })}
        />
        Primary contact
      </label>

      <Field label="Notes">
        <textarea
          value={values.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          rows={4}
          className={inputClass}
          style={inputStyle}
        />
      </Field>
    </>
  )
}
