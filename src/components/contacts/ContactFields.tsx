import { Combobox } from '@/components/Combobox'
import { Field, inputClass, inputStyle } from '@/components/form'
import { searchOrganisations, type OrganisationOption } from '@/lib/organisations'
import type { ContactFormState } from '@/components/contacts/contact-form'

interface ContactFieldsProps {
  values: ContactFormState
  onChange: (next: Partial<ContactFormState>) => void
  organisation: OrganisationOption | null
  onOrganisationChange: (next: OrganisationOption | null) => void
}

/**
 * The contact's editable fields, shared by the create modal and the contact
 * page so the two can't drift.
 */
export function ContactFields({ values, onChange, organisation, onOrganisationChange }: ContactFieldsProps) {
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

      <Field label="Organisation">
        <Combobox<OrganisationOption>
          value={organisation}
          onChange={onOrganisationChange}
          search={(q) => searchOrganisations(q)}
          getLabel={(o) => o.name}
          getKey={(o) => o.id}
          placeholder="Search organisations…"
        />
      </Field>

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
